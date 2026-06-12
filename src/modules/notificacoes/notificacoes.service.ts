import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nestjs';
import { createSupabaseClient } from '../../config/supabase.config';
import { WHATSAPP_PROVIDER } from '../zapi/whatsapp-provider.interface';
import type {
  WhatsappCredentials,
  WhatsappProvider,
} from '../zapi/whatsapp-provider.interface';
import { WppStatus } from '../../common/constants/lembrete.constants';
import { AuditoriaService } from '../auditoria/auditoria.service';

interface WppConfig {
  wpp_instance_id: string;
  wpp_token: string;
  wpp_status: WppStatus;
  nome: string;
  whatsapp: string;
  slug: string;
}

type EstadoNotificacaoWhatsapp = 'enviada' | 'falha' | 'nao_enviada';

interface NovaSolicitacaoEvt {
  profissional_id: string;
  cliente_nome: string;
  servico_nome: string;
  data_hora: string;
}

interface EventoCliente {
  profissional_id: string;
  cliente_wpp: string;
  cliente_nome: string;
  servico_nome: string;
  data_hora: string;
}

interface RecusaEvt extends EventoCliente {
  motivo_recusa?: string | null;
}

interface ReagendamentoEvt {
  profissional_id: string;
  cliente_wpp: string;
  cliente_nome: string;
  agendamento_id: string;
}

interface LembreteEvt extends EventoCliente {
  agendamento_id: string;
  cancelamento_auto: boolean;
}

const APP_URL_DEFAULT = 'https://www.kianna.com.br';

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  private readonly supabase: SupabaseClient;
  private readonly appUrl: string;

  constructor(
    @Inject(WHATSAPP_PROVIDER)
    private readonly whatsapp: WhatsappProvider,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {
    this.supabase = createSupabaseClient(config);
    this.appUrl = this.config.get<string>('APP_URL') ?? APP_URL_DEFAULT;
  }

  /**
   * Envia texto via provider e registra auditoria do envio.
   * Em caso de exceção do provider, captura no Sentry e re-lança.
   * `recursoId` é o profissional_id (referência da tabela `logs_auditoria`).
   */
  private async enviarTextoComAuditoria(
    profissionalId: string,
    creds: WhatsappCredentials,
    phone: string,
    message: string,
    contextoTipo: string,
  ): Promise<boolean> {
    try {
      const ok = await this.whatsapp.sendTextMessage({
        credentials: creds,
        phone,
        message,
      });
      if (!ok) {
        this.logger.warn(
          'Notificação WhatsApp não entregue ' +
            '(profissional=' +
            profissionalId +
            ', tipo=' +
            contextoTipo +
            ', motivo=provider_retornou_falha)',
        );
      }
      await this.registrarEstadoNotificacao({
        profissionalId,
        tipo: contextoTipo,
        destinatario: phone,
        status: ok ? 'enviada' : 'falha',
        motivo: ok ? null : 'provider_retornou_falha',
      });
      void this.auditoria.registrar({
        ator_id: profissionalId,
        ator_tipo: 'sistema',
        acao: ok ? 'notificacao_enviada' : 'notificacao_falha',
        recurso: 'whatsapp',
        recurso_id: profissionalId,
        detalhes: {
          tipo: contextoTipo,
          motivo: ok ? undefined : 'provider_retornou_falha',
        },
        resultado: ok ? 'sucesso' : 'falha',
      });
      return ok;
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      this.logger.error(
        'Falha ao enviar notificação WhatsApp ' +
          '(profissional=' +
          profissionalId +
          ', tipo=' +
          contextoTipo +
          '): ' +
          erro,
      );
      Sentry.captureException(err, {
        tags: { area: 'notificacoes', tipo: contextoTipo },
        extra: { profissional_id: profissionalId },
      });
      await this.registrarEstadoNotificacao({
        profissionalId,
        tipo: contextoTipo,
        destinatario: phone,
        status: 'falha',
        motivo: erro,
      });
      void this.auditoria.registrar({
        ator_id: profissionalId,
        ator_tipo: 'sistema',
        acao: 'notificacao_falha',
        recurso: 'whatsapp',
        recurso_id: profissionalId,
        detalhes: {
          tipo: contextoTipo,
          erro,
        },
        resultado: 'falha',
      });
      throw err;
    }
  }

  private async registrarNotificacaoNaoEnviada(
    profissionalId: string,
    tipo: string,
    motivo: string,
    destinatario?: string | null,
    detalhes?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.warn(
      'Notificação WhatsApp não enviada ' +
        '(profissional=' +
        profissionalId +
        ', tipo=' +
        tipo +
        ', motivo=' +
        motivo +
        ')',
    );
    await this.registrarEstadoNotificacao({
      profissionalId,
      tipo,
      destinatario,
      status: 'nao_enviada',
      motivo,
      detalhes,
    });
    void this.auditoria.registrar({
      ator_id: profissionalId,
      ator_tipo: 'sistema',
      acao: 'notificacao_falha',
      recurso: 'whatsapp',
      recurso_id: profissionalId,
      detalhes: { tipo, motivo, ...(detalhes ?? {}) },
      resultado: 'falha',
    });
  }

  private async registrarEstadoNotificacao(params: {
    profissionalId: string;
    tipo: string;
    destinatario?: string | null;
    status: EstadoNotificacaoWhatsapp;
    motivo?: string | null;
    detalhes?: Record<string, unknown> | null;
  }): Promise<void> {
    const { error } = await this.supabase.from('whatsapp_notificacoes').insert({
      profissional_id: params.profissionalId,
      tipo: params.tipo,
      destinatario: params.destinatario ?? null,
      status: params.status,
      motivo: params.motivo ?? null,
      detalhes: params.detalhes ?? null,
    });

    if (error) {
      this.logger.warn(
        'Falha ao registrar estado da notificação WhatsApp ' +
          '(' +
          params.tipo +
          '): ' +
          error.message,
      );
      Sentry.captureException(
        new Error('Registro de notificação WhatsApp falhou: ' + error.message),
        {
          tags: { area: 'notificacoes', tipo: params.tipo },
          extra: { profissional_id: params.profissionalId },
        },
      );
    }
  }

  private credsOf(wpp: WppConfig): WhatsappCredentials {
    return { instanceRef: wpp.wpp_instance_id, authToken: wpp.wpp_token };
  }

  /** Busca a configuração WhatsApp do profissional. Retorna null se não estiver pronto. */
  private async getWppConfig(
    profissionalId: string,
    contextoTipo: string,
    destinatario?: string,
  ): Promise<WppConfig | null> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('wpp_instance_id, wpp_token, wpp_status, nome, whatsapp, slug')
      .eq('id', profissionalId)
      .single<WppConfig>();

    if (error || !data) {
      this.logger.warn(
        'Profissional ' +
          profissionalId +
          ' não encontrado para notificação ' +
          contextoTipo,
      );
      return null;
    }

    if (!data.wpp_instance_id || !data.wpp_token) {
      await this.registrarNotificacaoNaoEnviada(
        profissionalId,
        contextoTipo,
        'whatsapp_sem_credenciais',
        destinatario ?? data.whatsapp,
      );
      return null;
    }

    if (data.wpp_status !== 'conectado') {
      const motivo =
        data.wpp_status === 'desconectado'
          ? 'whatsapp_desconectado'
          : 'whatsapp_status_' + data.wpp_status;
      await this.registrarNotificacaoNaoEnviada(
        profissionalId,
        contextoTipo,
        motivo,
        destinatario ?? data.whatsapp,
        { wpp_status: data.wpp_status },
      );
      return null;
    }
    return data;
  }

  // ───── 1. Nova solicitação → notifica profissional ─────
  async notificarNovaSolicitacao(evt: NovaSolicitacaoEvt): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'nova_solicitacao_profissional',
    );
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `✨ *Nova solicitação de agendamento*\n\n` +
      `👤 Cliente: ${evt.cliente_nome}\n` +
      `💈 Serviço: ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Acesse o painel para confirmar ou recusar.`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      wpp.whatsapp,
      msg,
      'nova_solicitacao_profissional',
    );
  }

  // ───── 2. Confirmado → notifica cliente ─────
  async notificarConfirmacao(evt: EventoCliente): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'confirmacao_cliente',
      evt.cliente_wpp,
    );
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `✅ *Agendamento confirmado!*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `Seu agendamento com ${wpp.nome} foi confirmado.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Até lá! 😊`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      evt.cliente_wpp,
      msg,
      'confirmacao_cliente',
    );
  }

  // ───── 3. Recusado → notifica cliente ─────
  async notificarRecusa(evt: RecusaEvt): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'recusa_cliente',
      evt.cliente_wpp,
    );
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    let msg =
      `❌ *Agendamento não confirmado*\n\n` +
      `Olá, ${evt.cliente_nome}.\n` +
      `Infelizmente ${wpp.nome} não pôde confirmar o agendamento.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}`;

    if (evt.motivo_recusa?.trim()) {
      msg += `\n\n📝 Motivo: ${evt.motivo_recusa.trim()}`;
    }

    msg += `\n\nVocê pode solicitar um novo horário em ${this.appUrl}/${wpp.slug}`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      evt.cliente_wpp,
      msg,
      'recusa_cliente',
    );
  }

  // ───── 4. Cancelado pelo profissional → notifica cliente ─────
  async notificarCancelamentoProfissional(evt: EventoCliente): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'cancelamento_profissional_cliente',
      evt.cliente_wpp,
    );
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `⚠️ *Agendamento cancelado*\n\n` +
      `Olá, ${evt.cliente_nome}.\n` +
      `${wpp.nome} precisou cancelar seu agendamento.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Você pode solicitar um novo horário em ${this.appUrl}/${wpp.slug}`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      evt.cliente_wpp,
      msg,
      'cancelamento_profissional_cliente',
    );
  }

  // ───── 5. Reagendamento iniciado pelo profissional → envia link ao cliente ─────
  async notificarReagendamento(evt: ReagendamentoEvt): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'reagendamento_cliente',
      evt.cliente_wpp,
    );
    if (!wpp) return;

    const link = `${this.appUrl}/${wpp.slug}?reagendar=${evt.agendamento_id}`;
    const msg =
      `🔄 *Reagendamento*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `${wpp.nome} precisa reagendar seu atendimento.\n\n` +
      `Clique no link para escolher um novo horário:\n${link}`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      evt.cliente_wpp,
      msg,
      'reagendamento_cliente',
    );
  }

  // ───── 6. Cancelamento pelo cliente → notifica profissional ─────
  async notificarCancelamentoCliente(
    evt: Omit<NovaSolicitacaoEvt, never>,
  ): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'cancelamento_cliente_profissional',
    );
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `⚠️ *Cancelamento pelo cliente*\n\n` +
      `${evt.cliente_nome} cancelou o agendamento.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `O horário foi liberado na sua agenda.`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      wpp.whatsapp,
      msg,
      'cancelamento_cliente_profissional',
    );
  }

  // ───── 7. Lembrete antes do atendimento (usado pelo cron — PR4) ─────
  async enviarLembrete(evt: LembreteEvt): Promise<boolean> {
    const tipoLembrete = evt.cancelamento_auto
      ? 'lembrete_botoes'
      : 'lembrete_simples';
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      tipoLembrete,
      evt.cliente_wpp,
    );
    if (!wpp) return false;

    const data = this.formatarDataHora(evt.data_hora);

    if (evt.cancelamento_auto) {
      const msg =
        `⏰ *Lembrete de agendamento*\n\n` +
        `Olá, ${evt.cliente_nome}!\n` +
        `Seu atendimento está chegando.\n\n` +
        `💈 ${evt.servico_nome}\n` +
        `📅 ${data}\n\n` +
        `Confirme sua presença:`;

      try {
        const ok = await this.whatsapp.sendButtonMessage({
          credentials: this.credsOf(wpp),
          phone: evt.cliente_wpp,
          message: msg,
          buttons: [
            { id: 'confirmar_presenca', label: '1 - Confirmar presença' },
            { id: 'cancelar_agendamento', label: '2 - Cancelar' },
          ],
        });
        if (!ok) {
          this.logger.warn(
            'Notificação WhatsApp não entregue ' +
              '(profissional=' +
              evt.profissional_id +
              ', tipo=lembrete_botoes, motivo=provider_retornou_falha)',
          );
        }
        await this.registrarEstadoNotificacao({
          profissionalId: evt.profissional_id,
          tipo: 'lembrete_botoes',
          destinatario: evt.cliente_wpp,
          status: ok ? 'enviada' : 'falha',
          motivo: ok ? null : 'provider_retornou_falha',
          detalhes: { agendamento_id: evt.agendamento_id },
        });
        void this.auditoria.registrar({
          ator_id: evt.profissional_id,
          ator_tipo: 'sistema',
          acao: ok ? 'notificacao_enviada' : 'notificacao_falha',
          recurso: 'whatsapp',
          recurso_id: evt.profissional_id,
          detalhes: {
            tipo: 'lembrete_botoes',
            agendamento_id: evt.agendamento_id,
          },
          resultado: ok ? 'sucesso' : 'falha',
        });
        return ok;
      } catch (err) {
        const erro = err instanceof Error ? err.message : String(err);
        this.logger.error(
          'Falha ao enviar notificação WhatsApp ' +
            '(profissional=' +
            evt.profissional_id +
            ', tipo=lembrete_botoes): ' +
            erro,
        );
        Sentry.captureException(err, {
          tags: { area: 'notificacoes', tipo: 'lembrete_botoes' },
          extra: { profissional_id: evt.profissional_id },
        });
        await this.registrarEstadoNotificacao({
          profissionalId: evt.profissional_id,
          tipo: 'lembrete_botoes',
          destinatario: evt.cliente_wpp,
          status: 'falha',
          motivo: erro,
          detalhes: { agendamento_id: evt.agendamento_id },
        });
        void this.auditoria.registrar({
          ator_id: evt.profissional_id,
          ator_tipo: 'sistema',
          acao: 'notificacao_falha',
          recurso: 'whatsapp',
          recurso_id: evt.profissional_id,
          detalhes: {
            tipo: 'lembrete_botoes',
            agendamento_id: evt.agendamento_id,
            erro,
          },
          resultado: 'falha',
        });
        throw err;
      }
    }

    const msg =
      `⏰ *Lembrete de agendamento*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `Seu atendimento está chegando.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Até lá! 😊`;

    return this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      evt.cliente_wpp,
      msg,
      'lembrete_simples',
    );
  }

  /** Formata ISO → "segunda-feira, 19/05/2026 às 14:30" (timezone Brasília). */
  private formatarDataHora(iso: string): string {
    const d = new Date(iso);
    const dia = d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });
    const hora = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    return `${dia} às ${hora}`;
  }
  // ───── 1b. Nova solicitação → confirma recebimento ao CLIENTE ─────
  async notificarSolicitacaoRecebidaCliente(evt: EventoCliente): Promise<void> {
    const wpp = await this.getWppConfig(
      evt.profissional_id,
      'solicitacao_recebida_cliente',
      evt.cliente_wpp,
    );
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `📩 *Solicitação recebida!*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `Recebemos seu pedido de agendamento com ${wpp.nome}.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `⏳ Aguarde a confirmação. Você receberá um aviso assim que ${wpp.nome} confirmar.`;

    await this.enviarTextoComAuditoria(
      evt.profissional_id,
      this.credsOf(wpp),
      evt.cliente_wpp,
      msg,
      'solicitacao_recebida_cliente',
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { ZapiService } from '../zapi/zapi.service';
import { WppStatus } from '../../common/constants/lembrete.constants';

interface WppConfig {
  wpp_instance_id: string;
  wpp_token: string;
  wpp_status: WppStatus;
  nome: string;
  whatsapp: string;
  slug: string;
}

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
    private readonly zapi: ZapiService,
    private readonly config: ConfigService,
  ) {
    this.supabase = createSupabaseClient(config);
    this.appUrl = this.config.get<string>('APP_URL') ?? APP_URL_DEFAULT;
  }

  /** Busca a configuração WhatsApp do profissional. Retorna null se não estiver pronto. */
  private async getWppConfig(
    profissionalId: string,
  ): Promise<WppConfig | null> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('wpp_instance_id, wpp_token, wpp_status, nome, whatsapp, slug')
      .eq('id', profissionalId)
      .single<WppConfig>();

    if (error || !data) {
      this.logger.warn(
        `Profissional ${profissionalId} não encontrado para notificação`,
      );
      return null;
    }
    if (!data.wpp_instance_id || !data.wpp_token) {
      this.logger.debug(`Profissional ${profissionalId} sem credenciais Z-API`);
      return null;
    }
    if (data.wpp_status !== 'conectado') {
      this.logger.debug(
        `Profissional ${profissionalId} com WhatsApp '${data.wpp_status}' — notificação ignorada`,
      );
      return null;
    }
    return data;
  }

  // ───── 1. Nova solicitação → notifica profissional ─────
  async notificarNovaSolicitacao(evt: NovaSolicitacaoEvt): Promise<void> {
    const wpp = await this.getWppConfig(evt.profissional_id);
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `✨ *Nova solicitação de agendamento*\n\n` +
      `👤 Cliente: ${evt.cliente_nome}\n` +
      `💈 Serviço: ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Acesse o painel para confirmar ou recusar.`;

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      wpp.whatsapp,
      msg,
    );
  }

  // ───── 2. Confirmado → notifica cliente ─────
  async notificarConfirmacao(evt: EventoCliente): Promise<void> {
    const wpp = await this.getWppConfig(evt.profissional_id);
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `✅ *Agendamento confirmado!*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `Seu agendamento com ${wpp.nome} foi confirmado.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Até lá! 😊`;

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      evt.cliente_wpp,
      msg,
    );
  }

  // ───── 3. Recusado → notifica cliente ─────
  async notificarRecusa(evt: RecusaEvt): Promise<void> {
    const wpp = await this.getWppConfig(evt.profissional_id);
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

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      evt.cliente_wpp,
      msg,
    );
  }

  // ───── 4. Cancelado pelo profissional → notifica cliente ─────
  async notificarCancelamentoProfissional(evt: EventoCliente): Promise<void> {
    const wpp = await this.getWppConfig(evt.profissional_id);
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `⚠️ *Agendamento cancelado*\n\n` +
      `Olá, ${evt.cliente_nome}.\n` +
      `${wpp.nome} precisou cancelar seu agendamento.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Você pode solicitar um novo horário em ${this.appUrl}/${wpp.slug}`;

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      evt.cliente_wpp,
      msg,
    );
  }

  // ───── 5. Reagendamento iniciado pelo profissional → envia link ao cliente ─────
  async notificarReagendamento(evt: ReagendamentoEvt): Promise<void> {
    const wpp = await this.getWppConfig(evt.profissional_id);
    if (!wpp) return;

    const link = `${this.appUrl}/${wpp.slug}?reagendar=${evt.agendamento_id}`;
    const msg =
      `🔄 *Reagendamento*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `${wpp.nome} precisa reagendar seu atendimento.\n\n` +
      `Clique no link para escolher um novo horário:\n${link}`;

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      evt.cliente_wpp,
      msg,
    );
  }

  // ───── 6. Cancelamento pelo cliente → notifica profissional ─────
  async notificarCancelamentoCliente(
    evt: Omit<NovaSolicitacaoEvt, never>,
  ): Promise<void> {
    const wpp = await this.getWppConfig(evt.profissional_id);
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `⚠️ *Cancelamento pelo cliente*\n\n` +
      `${evt.cliente_nome} cancelou o agendamento.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `O horário foi liberado na sua agenda.`;

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      wpp.whatsapp,
      msg,
    );
  }

  // ───── 7. Lembrete antes do atendimento (usado pelo cron — PR4) ─────
  async enviarLembrete(evt: LembreteEvt): Promise<boolean> {
    const wpp = await this.getWppConfig(evt.profissional_id);
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

      return this.zapi.enviarBotoes(
        wpp.wpp_instance_id,
        wpp.wpp_token,
        evt.cliente_wpp,
        msg,
        [
          { id: 'confirmar_presenca', label: '1 - Confirmar presença' },
          { id: 'cancelar_agendamento', label: '2 - Cancelar' },
        ],
      );
    }

    const msg =
      `⏰ *Lembrete de agendamento*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `Seu atendimento está chegando.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `Até lá! 😊`;

    return this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      evt.cliente_wpp,
      msg,
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
    const wpp = await this.getWppConfig(evt.profissional_id);
    if (!wpp) return;

    const data = this.formatarDataHora(evt.data_hora);
    const msg =
      `📩 *Solicitação recebida!*\n\n` +
      `Olá, ${evt.cliente_nome}!\n` +
      `Recebemos seu pedido de agendamento com ${wpp.nome}.\n\n` +
      `💈 ${evt.servico_nome}\n` +
      `📅 ${data}\n\n` +
      `⏳ Aguarde a confirmação. Você receberá um aviso assim que ${wpp.nome} confirmar.`;

    await this.zapi.enviarTexto(
      wpp.wpp_instance_id,
      wpp.wpp_token,
      evt.cliente_wpp, // ← número do CLIENTE
      msg,
    );
  }
}

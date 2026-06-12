import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nestjs';
import { createSupabaseClient } from '../../config/supabase.config';
import { WppStatus } from '../../common/constants/lembrete.constants';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { NotificadorEmail } from '../notificadores/notificador-email.service';

interface ProfissionalWppStatusRow {
  id: string;
  user_id: string | null;
  nome: string;
  slug: string;
  wpp_status: WppStatus | null;
  wpp_desconectado_em: string | null;
  wpp_aviso_desconexao_em: string | null;
}

const APP_URL_DEFAULT = 'https://www.kianna.com.br';

@Injectable()
export class WhatsappStatusService {
  private readonly logger = new Logger(WhatsappStatusService.name);
  private readonly supabase: SupabaseClient;
  private readonly appUrl: string;

  constructor(
    config: ConfigService,
    private readonly auditoria: AuditoriaService,
    private readonly email: NotificadorEmail,
  ) {
    this.supabase = createSupabaseClient(config);
    this.appUrl = config.get<string>('APP_URL') ?? APP_URL_DEFAULT;
  }

  async atualizarPorInstanceId(
    instanceId: string,
    status: WppStatus,
  ): Promise<void> {
    const { data: prof, error } = await this.supabase
      .from('profissionais')
      .select(
        'id, user_id, nome, slug, wpp_status, wpp_desconectado_em, wpp_aviso_desconexao_em',
      )
      .eq('wpp_instance_id', instanceId)
      .maybeSingle<ProfissionalWppStatusRow>();

    if (error) {
      this.logger.error(
        `Erro ao buscar profissional por instanceId (${instanceId}): ${error.message}`,
      );
      return;
    }

    if (!prof) {
      this.logger.warn(
        `Evento de status sem profissional vinculado (instance=${instanceId})`,
      );
      return;
    }

    await this.atualizarStatus(prof, status, { instance_id: instanceId });
  }

  async atualizarPorProfissionalId(
    profissionalId: string,
    status: WppStatus,
  ): Promise<void> {
    const { data: prof, error } = await this.supabase
      .from('profissionais')
      .select(
        'id, user_id, nome, slug, wpp_status, wpp_desconectado_em, wpp_aviso_desconexao_em',
      )
      .eq('id', profissionalId)
      .maybeSingle<ProfissionalWppStatusRow>();

    if (error) {
      this.logger.error(
        `Erro ao buscar profissional (${profissionalId}) para status WhatsApp: ${error.message}`,
      );
      return;
    }

    if (!prof) {
      this.logger.warn(
        `Atualização de status sem profissional vinculado (${profissionalId})`,
      );
      return;
    }

    await this.atualizarStatus(prof, status);
  }

  private async atualizarStatus(
    prof: ProfissionalWppStatusRow,
    status: WppStatus,
    detalhes: Record<string, unknown> = {},
  ): Promise<void> {
    const agora = new Date().toISOString();
    const novaQueda =
      status === 'desconectado' &&
      (prof.wpp_status !== 'desconectado' || !prof.wpp_desconectado_em);

    const payload: Record<string, unknown> = { wpp_status: status };

    if (status === 'desconectado' && novaQueda) {
      payload['wpp_desconectado_em'] = agora;
      payload['wpp_aviso_desconexao_em'] = null;
    }

    if (status === 'conectado') {
      payload['wpp_desconectado_em'] = null;
      payload['wpp_aviso_desconexao_em'] = null;
    }

    const { error } = await this.supabase
      .from('profissionais')
      .update(payload)
      .eq('id', prof.id);

    if (error) {
      this.logger.error(
        `Erro ao atualizar wpp_status (${prof.id} -> ${status}): ${error.message}`,
      );
      Sentry.captureException(
        new Error(`Falha ao atualizar wpp_status: ${error.message}`),
        {
          tags: { area: 'whatsapp_status' },
          extra: { profissional_id: prof.id, status },
        },
      );
      return;
    }

    this.logger.log(`Profissional ${prof.id}: WhatsApp ${status}`);

    if (status === 'desconectado' && novaQueda) {
      void this.auditoria.registrar({
        ator_id: prof.id,
        ator_tipo: 'sistema',
        acao: 'wpp_desconectado',
        recurso: 'whatsapp',
        recurso_id: prof.id,
        detalhes: { ...detalhes, desconectado_em: agora },
        resultado: 'sucesso',
      });

      await this.enviarAvisoDesconexao(prof, agora);
    }
  }

  private async enviarAvisoDesconexao(
    prof: ProfissionalWppStatusRow,
    desconectadoEm: string,
  ): Promise<void> {
    if (prof.wpp_aviso_desconexao_em) return;

    const email = await this.buscarEmailProfissional(prof);
    const link = `${this.appUrl}/dashboard/configuracoes?aba=whatsapp`;
    const subject = 'Seu WhatsApp desconectou da Kianna';
    const text =
      `Olá, ${prof.nome}.\n\n` +
      `Seu WhatsApp desconectou da Kianna em ${this.formatarDataHora(desconectadoEm)}. ` +
      `Enquanto ele estiver desconectado, as notificações automáticas não serão enviadas.\n\n` +
      `Reconecte pelo painel: ${link}`;

    let enviado = false;
    if (email) {
      enviado = await this.email.enviar({
        to: email,
        subject,
        text,
        html:
          `<p>Olá, ${this.escapeHtml(prof.nome)}.</p>` +
          `<p>Seu WhatsApp desconectou da Kianna em ${this.escapeHtml(this.formatarDataHora(desconectadoEm))}. Enquanto ele estiver desconectado, as notificações automáticas não serão enviadas.</p>` +
          `<p><a href="${this.escapeHtml(link)}">Reconectar WhatsApp</a></p>`,
      });
    } else {
      this.logger.warn(
        `Profissional ${prof.id} sem e-mail vinculado para aviso de WhatsApp desconectado`,
      );
    }

    const { error } = await this.supabase
      .from('profissionais')
      .update({ wpp_aviso_desconexao_em: new Date().toISOString() })
      .eq('id', prof.id);

    if (error) {
      this.logger.warn(
        `Falha ao marcar aviso de desconexão (${prof.id}): ${error.message}`,
      );
    }

    void this.auditoria.registrar({
      ator_id: prof.id,
      ator_tipo: 'sistema',
      acao: 'wpp_aviso_desconexao',
      recurso: 'whatsapp',
      recurso_id: prof.id,
      detalhes: { email_configurado: enviado, email_encontrado: !!email },
      resultado: enviado ? 'sucesso' : 'falha',
    });
  }

  private async buscarEmailProfissional(
    prof: ProfissionalWppStatusRow,
  ): Promise<string | null> {
    if (!prof.user_id) return null;
    const { data, error } = await this.supabase.auth.admin.getUserById(
      prof.user_id,
    );
    if (error) {
      this.logger.warn(
        `Falha ao buscar e-mail do profissional ${prof.id}: ${error.message}`,
      );
      return null;
    }
    return data.user?.email ?? null;
  }

  private formatarDataHora(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

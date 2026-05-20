import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { WppStatus } from '../../common/constants/lembrete.constants';
import { RespostasService } from '../respostas/respostas.service';

// Z-API publica vários tipos de evento. Listamos como string solta para
// permitir tratar eventos novos sem quebrar o TypeScript.
type EventoZapi = string;

interface MensagemRecebida {
  instanceId: string;
  phone: string;
  texto: string;
}

/**
 * Processa eventos recebidos da Z-API:
 *  - Connected/Disconnected/StatusInstance → atualiza `wpp_status` do profissional
 *  - ReceivedCallback → delega ao RespostasService para tratar "1"/"2"
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    config: ConfigService,
    private readonly respostas: RespostasService,
  ) {
    this.supabase = createSupabaseClient(config);
  }

  async processar(payload: Record<string, unknown>): Promise<void> {
    const tipo = (payload?.type as EventoZapi | undefined) ?? 'unknown';

    switch (tipo) {
      case 'ConnectedCallback':
        await this.atualizarStatus(payload, 'conectado');
        return;

      case 'DisconnectedCallback':
        await this.atualizarStatus(payload, 'desconectado');
        return;

      case 'StatusInstanceCallback': {
        const connected = (payload?.connected as boolean | undefined) ?? false;
        await this.atualizarStatus(
          payload,
          connected ? 'conectado' : 'desconectado',
        );
        return;
      }

      case 'ReceivedCallback': {
        const msg = this.extrairMensagem(payload);
        if (msg) {
          this.logger.log(
            `Mensagem recebida (instance=${msg.instanceId}, phone=${msg.phone}): "${msg.texto}"`,
          );
          await this.respostas.processarResposta(
            msg.instanceId,
            msg.phone,
            msg.texto,
          );
        }
        return;
      }

      case 'MessageStatusCallback':
      case 'DeliveryCallback':
        return;

      default:
        this.logger.debug(`Evento Z-API não tratado: ${tipo}`);
    }
  }

  private extrairMensagem(
    payload: Record<string, unknown>,
  ): MensagemRecebida | null {
    const instanceId = (payload?.instanceId as string | undefined) ?? '';
    const phone =
      (payload?.phone as string | undefined) ??
      (payload?.from as string | undefined) ??
      '';

    // Z-API pode entregar texto em formatos diferentes
    const textObj = payload?.text as { message?: string } | undefined;
    const texto =
      textObj?.message ??
      (payload?.body as string | undefined) ??
      (payload?.message as string | undefined) ??
      '';

    if (!instanceId || !phone || !texto) return null;
    return { instanceId, phone, texto: texto.trim() };
  }

  private async atualizarStatus(
    payload: Record<string, unknown>,
    status: WppStatus,
  ): Promise<void> {
    const instanceId = payload?.instanceId as string | undefined;
    if (!instanceId) {
      this.logger.warn('Evento de status sem instanceId — ignorado');
      return;
    }

    const { error } = await this.supabase
      .from('profissionais')
      .update({ wpp_status: status })
      .eq('wpp_instance_id', instanceId);

    if (error) {
      this.logger.error(
        `Erro ao atualizar wpp_status (${instanceId} → ${status}): ${error.message}`,
      );
      return;
    }
    this.logger.log(`Instância ${instanceId}: ${status}`);
  }
}

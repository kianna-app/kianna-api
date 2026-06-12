import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { WppStatus } from '../../common/constants/lembrete.constants';
import { RespostasService } from '../respostas/respostas.service';
import { WhatsappStatusService } from '../zapi/whatsapp-status.service';

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

  constructor(
    private readonly respostas: RespostasService,
    private readonly whatsappStatus: WhatsappStatusService,
  ) {}

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
          try {
            await this.respostas.processarResposta(
              msg.instanceId,
              msg.phone,
              msg.texto,
            );
          } catch (err) {
            Sentry.captureException(err, {
              tags: { area: 'webhook_zapi', tipo: 'ReceivedCallback' },
              extra: { instanceId: msg.instanceId },
            });
            this.logger.error(
              `Erro ao processar resposta (instance=${msg.instanceId}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
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

    await this.whatsappStatus.atualizarPorInstanceId(instanceId, status);
  }
}

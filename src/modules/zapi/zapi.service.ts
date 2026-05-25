import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  SendButtonMessageParams,
  SendTextMessageParams,
  WhatsappCredentials,
  WhatsappProvider,
  WhatsappStatus,
} from './whatsapp-provider.interface';

@Injectable()
export class ZapiService implements WhatsappProvider {
  private readonly logger = new Logger(ZapiService.name);
  private readonly baseUrl: string;
  private readonly clientToken: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('ZAPI_BASE_URL') ?? 'https://api.z-api.io';
    this.clientToken = this.config.get<string>('ZAPI_CLIENT_TOKEN');
  }

  /** Z-API exige o header `Client-Token` da conta em todas as chamadas REST. */
  private headers(): Record<string, string> {
    return this.clientToken ? { 'Client-Token': this.clientToken } : {};
  }

  private url(creds: WhatsappCredentials, path: string): string {
    return `${this.baseUrl}/instances/${creds.instanceRef}/token/${creds.authToken}${path}`;
  }

  async sendTextMessage(params: SendTextMessageParams): Promise<boolean> {
    try {
      const phone = this.formatarTelefone(params.phone);
      await axios.post(
        this.url(params.credentials, '/send-text'),
        { phone, message: params.message },
        { headers: this.headers(), timeout: 15000 },
      );
      this.logger.log(
        `Texto enviado para ${phone} (instance=${params.credentials.instanceRef})`,
      );
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Erro send-text: ${msg}`);
      return false;
    }
  }

  /**
   * Envia mensagem com botões. Se falhar, faz fallback para texto numerado.
   * (A Z-API tem variações na rota de botões dependendo do plano — em caso
   * de erro, o cliente ainda consegue responder "1" ou "2" no texto.)
   */
  async sendButtonMessage(params: SendButtonMessageParams): Promise<boolean> {
    try {
      const phone = this.formatarTelefone(params.phone);
      await axios.post(
        this.url(params.credentials, '/send-button-list'),
        {
          phone,
          message: params.message,
          buttonList: {
            buttons: params.buttons.map((b) => ({ id: b.id, label: b.label })),
          },
        },
        { headers: this.headers(), timeout: 15000 },
      );
      this.logger.log(`Botões enviados para ${phone}`);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Botões falharam, fallback p/ texto: ${msg}`);
      const opts = params.buttons.map((b) => b.label).join('\n');
      return this.sendTextMessage({
        credentials: params.credentials,
        phone: params.phone,
        message: `${params.message}\n\n${opts}`,
      });
    }
  }

  /** Retorna QR Code em base64 (sem o prefixo data:image/...). */
  async getConnectionQrCode(
    creds: WhatsappCredentials,
  ): Promise<string | null> {
    try {
      const { data } = await axios.get<{ value?: string }>(
        this.url(creds, '/qr-code/image'),
        { headers: this.headers(), timeout: 15000 },
      );
      return data?.value ?? null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Erro qr-code: ${msg}`);
      return null;
    }
  }

  /** Verifica status de conexão. */
  async getConnectionStatus(
    creds: WhatsappCredentials,
  ): Promise<WhatsappStatus> {
    try {
      const { data } = await axios.get<{ connected?: boolean }>(
        this.url(creds, '/status'),
        { headers: this.headers(), timeout: 15000 },
      );
      return { connected: !!data?.connected, raw: data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Erro status: ${msg}`);
      return { connected: false };
    }
  }

  /** Desconecta a instância. */
  async disconnect(creds: WhatsappCredentials): Promise<boolean> {
    try {
      await axios.get(this.url(creds, '/disconnect'), {
        headers: this.headers(),
        timeout: 15000,
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Erro disconnect: ${msg}`);
      return false;
    }
  }

  /** Normaliza telefone brasileiro para o formato 55DDDNNNNNNNNN. */
  private formatarTelefone(tel: string): string {
    const digits = tel.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
    return digits;
  }
}

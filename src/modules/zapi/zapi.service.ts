import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ZapiBotao {
  id: string;
  label: string;
}

export interface ZapiStatus {
  connected: boolean;
  raw?: unknown;
}

@Injectable()
export class ZapiService {
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

  private url(instanceId: string, instanceToken: string, path: string): string {
    return `${this.baseUrl}/instances/${instanceId}/token/${instanceToken}${path}`;
  }

  /** Envia mensagem de texto. Retorna true em caso de sucesso. */
  async enviarTexto(
    instanceId: string,
    instanceToken: string,
    telefone: string,
    mensagem: string,
  ): Promise<boolean> {
    try {
      const phone = this.formatarTelefone(telefone);
      await axios.post(
        this.url(instanceId, instanceToken, '/send-text'),
        { phone, message: mensagem },
        { headers: this.headers(), timeout: 15000 },
      );
      this.logger.log(`Texto enviado para ${phone} (instance=${instanceId})`);
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
  async enviarBotoes(
    instanceId: string,
    instanceToken: string,
    telefone: string,
    mensagem: string,
    botoes: ZapiBotao[],
  ): Promise<boolean> {
    try {
      const phone = this.formatarTelefone(telefone);
      await axios.post(
        this.url(instanceId, instanceToken, '/send-button-list'),
        {
          phone,
          message: mensagem,
          buttonList: {
            buttons: botoes.map((b) => ({ id: b.id, label: b.label })),
          },
        },
        { headers: this.headers(), timeout: 15000 },
      );
      this.logger.log(`Botões enviados para ${phone}`);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Botões falharam, fallback p/ texto: ${msg}`);
      const opts = botoes.map((b) => b.label).join('\n');
      return this.enviarTexto(
        instanceId,
        instanceToken,
        telefone,
        `${mensagem}\n\n${opts}`,
      );
    }
  }

  /** Retorna QR Code em base64 (sem o prefixo data:image/...). */
  async gerarQrCode(
    instanceId: string,
    instanceToken: string,
  ): Promise<string | null> {
    try {
      const { data } = await axios.get<{ value?: string }>(
        this.url(instanceId, instanceToken, '/qr-code/image'),
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
  async verificarStatus(
    instanceId: string,
    instanceToken: string,
  ): Promise<ZapiStatus> {
    try {
      const { data } = await axios.get<{ connected?: boolean }>(
        this.url(instanceId, instanceToken, '/status'),
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
  async desconectar(
    instanceId: string,
    instanceToken: string,
  ): Promise<boolean> {
    try {
      await axios.get(this.url(instanceId, instanceToken, '/disconnect'), {
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

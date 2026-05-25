/**
 * Abstração de provedor de WhatsApp.
 *
 * O sistema (notificações, controller de admin, etc.) depende desta interface,
 * nunca de uma implementação concreta. Hoje o único adapter é o Z-API
 * (`ZapiService`); no futuro, basta implementar um novo adapter para um BSP
 * oficial (ex.: 360dialog, Infobip) e trocar o registro no módulo —
 * `{ provide: WHATSAPP_PROVIDER, useClass: BspWhatsappProvider }` — sem mexer
 * nos consumidores.
 *
 * Detalhes específicos de cada provedor (formato de payload, headers, query
 * strings, etc.) ficam confinados ao adapter; eles não vazam neste contrato.
 */

/** Token de injeção do NestJS para resolver a implementação de WhatsappProvider. */
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';

/** Credenciais agnósticas de canal/instância do WhatsApp. */
export interface WhatsappCredentials {
  /** Identificador da instância/canal no provedor. */
  instanceRef: string;
  /** Token de autenticação específico do canal/instância. */
  authToken: string;
}

export interface WhatsappButton {
  id: string;
  label: string;
}

export interface WhatsappStatus {
  connected: boolean;
  raw?: unknown;
}

export interface SendTextMessageParams {
  credentials: WhatsappCredentials;
  phone: string;
  message: string;
}

export interface SendButtonMessageParams extends SendTextMessageParams {
  buttons: WhatsappButton[];
}

export interface WhatsappProvider {
  /** Envia mensagem de texto simples. Retorna true em caso de sucesso. */
  sendTextMessage(params: SendTextMessageParams): Promise<boolean>;

  /**
   * Envia mensagem com botões interativos. Se o provedor não suportar ou
   * falhar, deve degradar para texto numerado (fallback) e ainda assim retornar
   * true se o fallback foi entregue.
   */
  sendButtonMessage(params: SendButtonMessageParams): Promise<boolean>;

  /**
   * Retorna QR Code (base64, sem prefixo data:image/...) para parear a
   * instância, quando o provedor exigir esse fluxo. Para provedores oficiais
   * (BSP) que não usam QR Code, deve retornar null.
   */
  getConnectionQrCode(credentials: WhatsappCredentials): Promise<string | null>;

  /** Verifica o estado de conexão da instância/canal. */
  getConnectionStatus(
    credentials: WhatsappCredentials,
  ): Promise<WhatsappStatus>;

  /** Desconecta a instância (no-op para provedores que não suportam). */
  disconnect(credentials: WhatsappCredentials): Promise<boolean>;
}

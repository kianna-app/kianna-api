import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EnviarEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class NotificadorEmail {
  private readonly logger = new Logger(NotificadorEmail.name);

  constructor(private readonly config: ConfigService) {}

  async enviar(params: EnviarEmailParams): Promise<boolean> {
    const provider = this.config.get<string>('EMAIL_PROVIDER');

    if (!provider) {
      // TODO(email-transacional): configurar um provedor SMTP/transacional
      // e trocar este stub por um adapter real mantendo esta interface.
      this.logger.warn(
        `E-mail transacional não configurado. Aviso não enviado para ${params.to}: ${params.subject}`,
      );
      return false;
    }

    // TODO(email-transacional): implementar adapter real quando as variáveis do
    // provedor forem definidas no ambiente.
    this.logger.warn(
      `EMAIL_PROVIDER=${provider} informado, mas adapter de e-mail ainda não implementado. Aviso não enviado para ${params.to}: ${params.subject}`,
    );
    return false;
  }
}

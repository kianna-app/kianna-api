import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { ZapiWebhookDto } from './dto/zapi-webhook.dto';
import { WebhooksService } from './webhooks.service';
// ... seus outros imports

@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly service: WebhooksService,
    private readonly config: ConfigService,
  ) {}

  @Post('zapi')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async zapi(
    @Body() body: ZapiWebhookDto,
    @Headers('x-zapi-token') headerToken: string | undefined,
    @Query('token') queryToken: string | undefined,
  ): Promise<{ ok: boolean }> {
    const expected = this.config.get<string>('ZAPI_WEBHOOK_TOKEN');

    // Falha fechada: sem token configurado, rejeita tudo
    if (!expected) {
      this.logger.error('ZAPI_WEBHOOK_TOKEN não configurado no ambiente');
      throw new InternalServerErrorException('Webhook não configurado');
    }

    const received = headerToken ?? queryToken;
    if (received !== expected) {
      this.logger.warn(
        `Token Z-API inválido (header=${!!headerToken}, query=${!!queryToken})`,
      );
      throw new UnauthorizedException('Token Z-API inválido');
    }

    this.logger.log(`Webhook Z-API recebido: type=${body?.type ?? 'unknown'}`);
    await this.service.processar(body);
    return { ok: true };
  }
}

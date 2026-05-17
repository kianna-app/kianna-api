import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZapiWebhookDto } from './dto/zapi-webhook.dto';

@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly config: ConfigService) {}

  @Post('zapi')
  @ApiOperation({
    summary:
      'Receber mensagens Z-API (sem auth, validação por token no header)',
  })
  zapi(
    @Body() body: ZapiWebhookDto,
    @Headers('x-zapi-token') token: string | undefined,
  ): { ok: boolean } {
    const expected = this.config.get<string>('ZAPI_WEBHOOK_TOKEN');
    if (expected && token !== expected) {
      throw new UnauthorizedException('Token Z-API inválido');
    }

    this.logger.log(
      `Webhook Z-API recebido de ${body.phone ?? 'desconhecido'}`,
    );
    return { ok: true };
  }
}

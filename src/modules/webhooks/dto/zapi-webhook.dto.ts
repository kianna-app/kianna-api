import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Payload do webhook Z-API. A estrutura varia conforme `type`:
 *  - ReceivedCallback        → mensagem recebida (phone, text.message)
 *  - MessageStatusCallback   → status de mensagem enviada
 *  - DeliveryCallback        → entrega
 *  - ConnectedCallback       → instância conectou
 *  - DisconnectedCallback    → instância desconectou
 *  - StatusInstanceCallback  → mudança de status genérica
 *
 * Validação leve (apenas campos top-level conhecidos). O resto vai em `payload`
 * para que o service consiga inspecionar sem perder dados.
 */
export class ZapiWebhookDto {
  @ApiPropertyOptional({ description: 'Tipo do evento Z-API' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instanceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  payload?: Record<string, unknown>;

  // Z-API envia muitos campos não documentados — preservamos via index signature.
  [key: string]: unknown;
}

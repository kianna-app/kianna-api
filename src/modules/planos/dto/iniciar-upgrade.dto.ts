import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { PLANO_IDS } from '../planos.catalog';
import type { PlanoId } from '../planos.catalog';

export class IniciarUpgradeDto {
  @ApiProperty({ enum: PLANO_IDS, example: 'pro' })
  @IsString()
  @IsIn(PLANO_IDS)
  planoId!: PlanoId;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { PLANO_IDS } from '../../planos/planos.catalog';
import type { PlanoId } from '../../planos/planos.catalog';

export class AlterarPlanoDto {
  @ApiProperty({ enum: PLANO_IDS, example: 'pro' })
  @IsString()
  @IsIn(PLANO_IDS)
  plano!: PlanoId;
}

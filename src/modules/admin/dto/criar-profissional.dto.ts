import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PLANO_IDS } from '../../planos/planos.catalog';
import type { PlanoId } from '../../planos/planos.catalog';

export class CriarProfissionalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Senha temporária definida pelo admin' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  senhaTemporaria!: string;

  @ApiProperty({
    description: 'Slug em minúsculas, sem espaços/acentos, com hífens',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug deve conter apenas minúsculas, números e hífens',
  })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsapp?: string;

  @ApiPropertyOptional({ enum: PLANO_IDS, default: 'gratis' })
  @IsOptional()
  @IsIn(PLANO_IDS)
  plano?: PlanoId;
}

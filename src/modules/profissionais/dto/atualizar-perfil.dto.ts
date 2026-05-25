import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AtualizarPerfilDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() foto_url?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsapp?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  especialidade?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?:
    | string
    | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  politica_cancelamento?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() endereco_cep?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco_rua?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco_numero?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco_complemento?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco_bairro?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco_cidade?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco_estado?:
    | string
    | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  instagram_url?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  facebook_url?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  twitter_url?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  youtube_url?: string | null;

  @ApiPropertyOptional() @IsOptional() links_personalizados?: {
    label: string;
    url: string;
  }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  antecedencia_minima_horas?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  antecedencia_maxima_dias?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboarding_concluido?: boolean;
}

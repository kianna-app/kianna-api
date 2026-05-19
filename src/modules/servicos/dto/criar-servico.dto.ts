import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarServicoDto {
  @ApiProperty({ example: 'Corte de cabelo' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome!: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(5)
  @Max(480)
  duracao_min!: number;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @Min(0)
  preco!: number;

  @ApiProperty({ enum: ['presencial', 'domiciliar', 'online'] })
  @IsIn(['presencial', 'domiciliar', 'online'])
  modalidade!: 'presencial' | 'domiciliar' | 'online';

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

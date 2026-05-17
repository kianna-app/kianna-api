import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CriarAgendamentoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  profissional_id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  servico_id!: string;

  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  cliente_nome!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  cliente_wpp!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  data_hora!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  agendamento_origem_id?: string;
}

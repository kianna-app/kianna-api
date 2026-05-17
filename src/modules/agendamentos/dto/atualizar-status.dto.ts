import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type AgendamentoStatus =
  | 'pendente'
  | 'confirmado'
  | 'recusado'
  | 'cancelado'
  | 'reagendado'
  | 'finalizado'
  | 'nao_compareceu';

const STATUS_VALUES: AgendamentoStatus[] = [
  'pendente',
  'confirmado',
  'recusado',
  'cancelado',
  'reagendado',
  'finalizado',
  'nao_compareceu',
];

export class AtualizarStatusDto {
  @ApiProperty({ enum: STATUS_VALUES })
  @IsIn(STATUS_VALUES)
  status!: AgendamentoStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo_recusa?: string;
}

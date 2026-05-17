import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export type AgendamentoStatus =
  | 'pendente'
  | 'confirmado'
  | 'recusado'
  | 'cancelado'
  | 'realizado';

export class AtualizarStatusDto {
  @ApiProperty({
    enum: ['pendente', 'confirmado', 'recusado', 'cancelado', 'realizado'],
  })
  @IsIn(['pendente', 'confirmado', 'recusado', 'cancelado', 'realizado'])
  status!: AgendamentoStatus;
}

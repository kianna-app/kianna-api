import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CriarServicoDto } from './criar-servico.dto';

export class AtualizarServicoDto extends PartialType(CriarServicoDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

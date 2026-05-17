import { PartialType } from '@nestjs/swagger';
import { CriarDisponibilidadeDto } from './criar-disponibilidade.dto';

export class AtualizarDisponibilidadeDto extends PartialType(
  CriarDisponibilidadeDto,
) {}

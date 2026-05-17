import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarBloqueioDto {
  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  data!: string;

  @ApiProperty({
    example: '14:00',
    required: false,
    description: 'null = dia inteiro',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hora_inicio?: string;

  @ApiProperty({ example: '16:00', required: false })
  @ValidateIf((o: CriarBloqueioDto) => !!o.hora_inicio)
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hora_fim?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motivo?: string;
}

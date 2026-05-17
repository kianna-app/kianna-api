import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarDisponibilidadeDto {
  @ApiProperty({ example: 1, description: '0=dom, 1=seg, ..., 6=sab' })
  @IsInt()
  @Min(0)
  @Max(6)
  dia_semana!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hora_inicio!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hora_fim!: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(5)
  @Max(120)
  intervalo_min!: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacidade?: number;
}

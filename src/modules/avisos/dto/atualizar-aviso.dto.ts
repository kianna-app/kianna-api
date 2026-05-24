import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AtualizarAvisoDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MinLength(1) @MaxLength(5000)
  corpo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  publicar_em?: string;

  @ApiPropertyOptional({ enum: ['todos', 'selecionados'] })
  @IsOptional() @IsString() @IsIn(['todos', 'selecionados'])
  destino?: 'todos' | 'selecionados';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray() @ArrayMaxSize(500) @ArrayUnique()
  @IsUUID('4', { each: true })
  destinatarios?: string[];
}

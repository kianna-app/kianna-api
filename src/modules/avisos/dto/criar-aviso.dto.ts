import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';

export class CriarAvisoDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  titulo!: string;

  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString() @MinLength(1) @MaxLength(5000)
  corpo!: string;

  @ApiPropertyOptional({ description: 'ISO timestamp. Default = agora.' })
  @IsOptional() @IsDateString()
  publicar_em?: string;

  @ApiProperty({ enum: ['todos', 'selecionados'] })
  @IsString() @IsIn(['todos', 'selecionados'])
  destino!: 'todos' | 'selecionados';

  @ApiPropertyOptional({
    description: 'UUIDs de profissionais; obrigatório quando destino=selecionados',
    type: [String],
  })
  @ValidateIf(o => o.destino === 'selecionados')
  @IsArray() @ArrayMaxSize(500) @ArrayUnique()
  @IsUUID('4', { each: true })
  destinatarios?: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWhatsappDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  wpp_instance_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  wpp_token!: string;
}

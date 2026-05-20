import { Module } from '@nestjs/common';
import { RespostasService } from './respostas.service';

@Module({
  providers: [RespostasService],
  exports: [RespostasService],
})
export class RespostasModule {}

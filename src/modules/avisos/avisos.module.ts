import { Module } from '@nestjs/common';
import { AvisosService } from './avisos.service';
import { AvisosAdminController, AvisosController } from './avisos.controller';

@Module({
  controllers: [AvisosAdminController, AvisosController],
  providers: [AvisosService],
})
export class AvisosModule {}

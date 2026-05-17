import { Module } from '@nestjs/common';
import { BloqueiosController } from './bloqueios.controller';
import { BloqueiosService } from './bloqueios.service';

@Module({
  controllers: [BloqueiosController],
  providers: [BloqueiosService],
  exports: [BloqueiosService],
})
export class BloqueiosModule {}

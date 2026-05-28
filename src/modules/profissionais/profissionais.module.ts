import { Module } from '@nestjs/common';
import { ProfissionaisController } from './profissionais.controller';
import { ProfissionaisService } from './profissionais.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService],
  exports: [ProfissionaisService],
})
export class ProfissionaisModule {}

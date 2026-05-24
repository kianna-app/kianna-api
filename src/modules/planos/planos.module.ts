import { Module } from '@nestjs/common';
import { PlanosController } from './planos.controller';
import { PlanosService } from './planos.service';
import { ProfissionaisModule } from '../profissionais/profissionais.module';

@Module({
  imports: [ProfissionaisModule],
  controllers: [PlanosController],
  providers: [PlanosService],
})
export class PlanosModule {}

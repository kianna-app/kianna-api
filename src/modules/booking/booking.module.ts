import { Module } from '@nestjs/common';
import { ProfissionaisModule } from '../profissionais/profissionais.module';
import { ServicosModule } from '../servicos/servicos.module';
import { DisponibilidadesModule } from '../disponibilidades/disponibilidades.module';
import { BloqueiosModule } from '../bloqueios/bloqueios.module';
import { AgendamentosModule } from '../agendamentos/agendamentos.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [
    ProfissionaisModule,
    ServicosModule,
    DisponibilidadesModule,
    BloqueiosModule,
    AgendamentosModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}

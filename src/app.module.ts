import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import appConfig from './config/app.config';
import { AgendamentosModule } from './modules/agendamentos/agendamentos.module';
import { ProfissionaisModule } from './modules/profissionais/profissionais.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ServicosModule } from './modules/servicos/servicos.module';
import { DisponibilidadesModule } from './modules/disponibilidades/disponibilidades.module';
import { BloqueiosModule } from './modules/bloqueios/bloqueios.module';
import { BookingModule } from './modules/booking/booking.module';
import { ZapiModule } from './modules/zapi/zapi.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { RespostasModule } from './modules/respostas/respostas.module';
import { LembretesModule } from './modules/lembretes/lembretes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ScheduleModule.forRoot(),
    ZapiModule,
    NotificacoesModule,
    RespostasModule,
    LembretesModule,
    AgendamentosModule,
    ProfissionaisModule,
    WebhooksModule,
    ServicosModule,
    DisponibilidadesModule,
    BloqueiosModule,
    BookingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

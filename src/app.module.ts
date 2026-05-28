import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import appConfig from './config/app.config';
import { AgendamentosModule } from './modules/agendamentos/agendamentos.module';
import { ProfissionaisModule } from './modules/profissionais/profissionais.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ServicosModule } from './modules/servicos/servicos.module';
import { DisponibilidadesModule } from './modules/disponibilidades/disponibilidades.module';
import { BloqueiosModule } from './modules/bloqueios/bloqueios.module';
import { BookingModule } from './modules/booking/booking.module';
import { AdminModule } from './modules/admin/admin.module';
import { ZapiModule } from './modules/zapi/zapi.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { RespostasModule } from './modules/respostas/respostas.module';
import { LembretesModule } from './modules/lembretes/lembretes.module';
import { PlanosModule } from './modules/planos/planos.module';
import { AvisosModule } from './modules/avisos/avisos.module';
import { RelatorioModule } from './modules/relatorio/relatorio.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    SentryModule.forRoot(),
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
    AdminModule,
    PlanosModule,
    AvisosModule,
    RelatorioModule,
    AuditoriaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

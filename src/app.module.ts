import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import appConfig from './config/app.config';
import { AgendamentosModule } from './modules/agendamentos/agendamentos.module';
import { ProfissionaisModule } from './modules/profissionais/profissionais.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ServicosModule } from './modules/servicos/servicos.module';
import { DisponibilidadesModule } from './modules/disponibilidades/disponibilidades.module';
import { BloqueiosModule } from './modules/bloqueios/bloqueios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    AgendamentosModule,
    ProfissionaisModule,
    WebhooksModule,
    ServicosModule,
    DisponibilidadesModule,
    BloqueiosModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

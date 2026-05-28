import { Global, Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Global()
@Module({
  imports: [AuditoriaModule],
  providers: [NotificacoesService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}

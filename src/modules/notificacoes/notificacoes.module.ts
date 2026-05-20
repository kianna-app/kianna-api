import { Global, Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';

@Global()
@Module({
  providers: [NotificacoesService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}

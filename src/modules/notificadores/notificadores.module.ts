import { Global, Module } from '@nestjs/common';
import { NotificadorEmail } from './notificador-email.service';

@Global()
@Module({
  providers: [NotificadorEmail],
  exports: [NotificadorEmail],
})
export class NotificadoresModule {}

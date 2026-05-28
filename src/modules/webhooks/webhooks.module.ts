import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { RespostasModule } from '../respostas/respostas.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [RespostasModule, AuditoriaModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

import { Global, Module } from '@nestjs/common';
import { ZapiController } from './zapi.controller';
import { ZapiService } from './zapi.service';
import { WhatsappStatusService } from './whatsapp-status.service';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NotificadoresModule } from '../notificadores/notificadores.module';

// TODO(BSP): para trocar o provedor (ex.: 360dialog/Infobip oficial), criar um
// novo adapter que implemente WhatsappProvider e substituir o registro abaixo
// por { provide: WHATSAPP_PROVIDER, useClass: BspWhatsappProvider } — nenhum
// consumidor (notificações, controller, etc.) precisa ser alterado.
@Global()
@Module({
  imports: [AuditoriaModule, NotificadoresModule],
  controllers: [ZapiController],
  providers: [
    ZapiService,
    WhatsappStatusService,
    { provide: WHATSAPP_PROVIDER, useExisting: ZapiService },
  ],
  exports: [WHATSAPP_PROVIDER, WhatsappStatusService],
})
export class ZapiModule {}

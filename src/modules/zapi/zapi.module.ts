import { Global, Module } from '@nestjs/common';
import { ZapiController } from './zapi.controller';
import { ZapiService } from './zapi.service';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';

// TODO(BSP): para trocar o provedor (ex.: 360dialog/Infobip oficial), criar um
// novo adapter que implemente WhatsappProvider e substituir o registro abaixo
// por { provide: WHATSAPP_PROVIDER, useClass: BspWhatsappProvider } — nenhum
// consumidor (notificações, controller, etc.) precisa ser alterado.
@Global()
@Module({
  controllers: [ZapiController],
  providers: [
    ZapiService,
    { provide: WHATSAPP_PROVIDER, useExisting: ZapiService },
  ],
  exports: [WHATSAPP_PROVIDER],
})
export class ZapiModule {}

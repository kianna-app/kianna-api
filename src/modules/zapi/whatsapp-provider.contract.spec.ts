import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  WHATSAPP_PROVIDER,
  WhatsappProvider,
} from './whatsapp-provider.interface';
import { ZapiService } from './zapi.service';

// Contrato mínimo: o token WHATSAPP_PROVIDER deve resolver para uma
// implementação válida de WhatsappProvider (hoje, ZapiService). Não chama
// a API real — apenas verifica DI e o shape do contrato.
describe('WhatsappProvider (contract)', () => {
  let provider: WhatsappProvider;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: { get: () => undefined } },
        ZapiService,
        { provide: WHATSAPP_PROVIDER, useExisting: ZapiService },
      ],
    }).compile();

    provider = moduleRef.get<WhatsappProvider>(WHATSAPP_PROVIDER);
  });

  it('resolve uma implementação a partir do token WHATSAPP_PROVIDER', () => {
    expect(provider).toBeDefined();
  });

  it('expõe todos os métodos do contrato WhatsappProvider', () => {
    expect(typeof provider.sendTextMessage).toBe('function');
    expect(typeof provider.sendButtonMessage).toBe('function');
    expect(typeof provider.getConnectionQrCode).toBe('function');
    expect(typeof provider.getConnectionStatus).toBe('function');
    expect(typeof provider.disconnect).toBe('function');
  });
});

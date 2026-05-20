import { Global, Module } from '@nestjs/common';
import { ZapiController } from './zapi.controller';
import { ZapiService } from './zapi.service';

@Global()
@Module({
  controllers: [ZapiController],
  providers: [ZapiService],
  exports: [ZapiService],
})
export class ZapiModule {}

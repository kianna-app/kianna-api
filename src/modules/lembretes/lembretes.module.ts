import { Module } from '@nestjs/common';
import { LembretesService } from './lembretes.service';

@Module({
  providers: [LembretesService],
})
export class LembretesModule {}

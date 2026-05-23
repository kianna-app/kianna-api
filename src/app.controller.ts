import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Identificação do serviço (raiz)' })
  root(): { status: string; service: string } {
    return { status: 'ok', service: 'kianna-api' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check da API' })
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';

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

  @Get('debug/sentry-test')
  @ApiExcludeEndpoint()
  sentryTest(): void {
    throw new Error('Sentry teste Kianna - pode remover');
  }
}

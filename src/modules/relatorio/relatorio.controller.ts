import {
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  ParseIntPipe,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RelatorioService } from './relatorio.service';
import { PLAN_LIMITS } from '../../common/constants/plan.limits';
import { PlanoId } from '../planos/planos.catalog';

@ApiTags('relatorio')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('api/relatorio')
export class RelatorioController {
  constructor(private readonly service: RelatorioService) {}

  @Get()
  @ApiOperation({ summary: 'Relatório mensal do profissional logado' })
  @ApiQuery({ name: 'ano', required: false, type: Number })
  @ApiQuery({ name: 'mes', required: false, type: Number, description: '1-12' })
  mensal(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
    @CurrentUser('plano') planoRaw: string | undefined,
    @Query('ano', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    ano: number,
    @Query('mes', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe)
    mes: number,
  ) {
    if (!profissionalId)
      throw new UnauthorizedException('Profissional não vinculado');

    const plano = (planoRaw as PlanoId) ?? 'gratis';
    if (!PLAN_LIMITS[plano].relatorio) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        resource: 'relatorio',
        message: 'Relatórios estão disponíveis apenas no plano Studio. Faça upgrade para ter acesso.',
      });
    }

    return this.service.doMes(profissionalId, ano, mes);
  }
}

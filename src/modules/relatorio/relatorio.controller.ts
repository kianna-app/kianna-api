import {
  Controller,
  DefaultValuePipe,
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
    @Query('ano', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    ano: number,
    @Query('mes', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe)
    mes: number,
  ) {
    if (!profissionalId)
      throw new UnauthorizedException('Profissional não vinculado');
    return this.service.doMes(profissionalId, ano, mes);
  }
}

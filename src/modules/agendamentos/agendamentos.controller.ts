import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgendamentosService } from './agendamentos.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AtualizarStatusDto } from './dto/atualizar-status.dto';
import { ReagendarDto } from './dto/reagendar.dto';
import { AtualizarAgendamentoDto } from './dto/atualizar-agendamento.dto';

@ApiTags('agendamentos')
@Controller('api/agendamentos')
export class AgendamentosController {
  constructor(private readonly service: AgendamentosService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Listar agendamentos do profissional logado' })
  listar(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    if (!profissionalId) throw new UnauthorizedException('Profissional não vinculado');
    return this.service.listarPorPeriodo(profissionalId, inicio, fim);
  }

  @Post()
  @ApiOperation({ summary: 'Criar agendamento (público)' })
  criar(@Body() dto: CriarAgendamentoDto) {
    return this.service.criar(dto);
  }

  @Post('reagendar')
  @ApiOperation({ summary: 'Reagendar (público — atualiza original e cria novo)' })
  reagendar(@Body() dto: ReagendarDto) {
    return this.service.reagendar(dto.profissional_id, dto);
  }

  @Patch('finalizar-vencidos')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: 'Marcar agendamentos confirmados com data passada como finalizados',
  })
  finalizarVencidos(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
  ) {
    if (!profissionalId) throw new UnauthorizedException('Profissional não vinculado');
    return this.service.finalizarVencidos(profissionalId);
  }

  @Get('pendentes/count')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Contagem de agendamentos pendentes do usuário' })
  contarPendentes(@CurrentUser('id') userId: string) {
    return this.service.contarPendentes(userId).then((count) => ({ count }));
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Detalhe do agendamento' })
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalhe(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Atualizar status do agendamento' })
  atualizarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarStatusDto,
  ) {
    return this.service.atualizarStatus(id, dto.status, dto.motivo_recusa);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Atualizar dados do agendamento' })
  atualizar(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarAgendamentoDto,
  ) {
    if (!profissionalId) throw new UnauthorizedException('Profissional não vinculado');
    return this.service.atualizar(profissionalId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Excluir agendamento' })
  excluir(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!profissionalId) throw new UnauthorizedException('Profissional não vinculado');
    return this.service.excluir(profissionalId, id);
  }
}

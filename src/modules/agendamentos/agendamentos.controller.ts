import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgendamentosService } from './agendamentos.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AtualizarStatusDto } from './dto/atualizar-status.dto';

@ApiTags('agendamentos')
@Controller('api/agendamentos')
export class AgendamentosController {
  constructor(private readonly service: AgendamentosService) {}

  @Post()
  @ApiOperation({ summary: 'Criar agendamento (público)' })
  criar(@Body() dto: CriarAgendamentoDto) {
    return this.service.criar(dto);
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
    return this.service.atualizarStatus(id, dto.status);
  }
}

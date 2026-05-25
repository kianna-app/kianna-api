import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AvisosService } from './avisos.service';
import { CriarAvisoDto } from './dto/criar-aviso.dto';
import { AtualizarAvisoDto } from './dto/atualizar-aviso.dto';

@ApiTags('avisos-admin')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin/avisos')
export class AvisosAdminController {
  constructor(private readonly service: AvisosService) {}

  @Get()
  @ApiOperation({ summary: 'Histórico de avisos com status e métricas' })
  historico() {
    return this.service.listarHistorico();
  }

  @Post()
  @ApiOperation({ summary: 'Criar aviso (agendado se publicar_em > now)' })
  criar(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
    @Body() dto: CriarAvisoDto,
  ) {
    if (!profissionalId) throw new UnauthorizedException();
    return this.service.criar(dto, profissionalId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar aviso' })
  atualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarAvisoDto,
  ) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir aviso (soft-delete)' })
  excluir(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.excluir(id);
  }

  @Get(':id/leituras')
  @ApiOperation({ summary: 'Status de leitura por profissional' })
  leituras(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.leiturasPorAviso(id);
  }
}

@ApiTags('avisos')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('api/avisos')
export class AvisosController {
  constructor(private readonly service: AvisosService) {}

  @Get()
  @ApiOperation({ summary: 'Meus avisos publicados (com status de leitura)' })
  meusAvisos(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
  ) {
    if (!profissionalId) throw new UnauthorizedException();
    return this.service.listarParaProfissional(profissionalId);
  }

  @Post(':id/ler')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar aviso como lido' })
  marcarLido(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('profissional_id') profissionalId: string | undefined,
  ) {
    if (!profissionalId) throw new UnauthorizedException();
    return this.service.marcarComoLida(id, profissionalId);
  }
}

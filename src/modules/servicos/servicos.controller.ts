import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ServicosService } from './servicos.service';
import { CriarServicoDto } from './dto/criar-servico.dto';
import { AtualizarServicoDto } from './dto/atualizar-servico.dto';

@ApiTags('servicos')
@Controller('api/servicos')
export class ServicosController {
  constructor(private readonly service: ServicosService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Listar serviços do profissional' })
  listar(@CurrentUser('profissional_id') profId?: string) {
    return this.service.listar(profId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Buscar serviço por ID' })
  buscar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('profissional_id') profId?: string,
  ) {
    return this.service.buscarPorId(id, profId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Criar serviço' })
  criar(
    @Body() dto: CriarServicoDto,
    @CurrentUser('profissional_id') profId?: string,
  ) {
    return this.service.criar(profId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Atualizar serviço' })
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarServicoDto,
    @CurrentUser('profissional_id') profId?: string,
  ) {
    return this.service.atualizar(id, profId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Excluir serviço' })
  async excluir(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('profissional_id') profId?: string,
  ): Promise<void> {
    await this.service.excluir(id, profId);
  }
}

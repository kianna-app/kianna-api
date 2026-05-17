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
import { DisponibilidadesService } from './disponibilidades.service';
import { CriarDisponibilidadeDto } from './dto/criar-disponibilidade.dto';
import { AtualizarDisponibilidadeDto } from './dto/atualizar-disponibilidade.dto';

@ApiTags('disponibilidades')
@Controller('api/disponibilidades')
export class DisponibilidadesController {
  constructor(private readonly service: DisponibilidadesService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Listar disponibilidades do profissional' })
  listar(@CurrentUser('profissional_id') profId?: string) {
    return this.service.listar(profId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Criar disponibilidade' })
  criar(
    @Body() dto: CriarDisponibilidadeDto,
    @CurrentUser('profissional_id') profId?: string,
  ) {
    return this.service.criar(profId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Atualizar disponibilidade' })
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarDisponibilidadeDto,
    @CurrentUser('profissional_id') profId?: string,
  ) {
    return this.service.atualizar(id, profId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Excluir disponibilidade' })
  async excluir(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('profissional_id') profId?: string,
  ): Promise<void> {
    await this.service.excluir(id, profId);
  }
}

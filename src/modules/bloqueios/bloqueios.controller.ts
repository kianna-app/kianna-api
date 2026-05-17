import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BloqueiosService } from './bloqueios.service';
import { CriarBloqueioDto } from './dto/criar-bloqueio.dto';

@ApiTags('bloqueios')
@Controller('api/bloqueios')
export class BloqueiosController {
  constructor(private readonly service: BloqueiosService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Listar bloqueios futuros' })
  listar(@CurrentUser('profissional_id') profId?: string) {
    return this.service.listar(profId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Criar bloqueio de agenda' })
  criar(
    @Body() dto: CriarBloqueioDto,
    @CurrentUser('profissional_id') profId?: string,
  ) {
    return this.service.criar(profId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Excluir bloqueio' })
  async excluir(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('profissional_id') profId?: string,
  ): Promise<void> {
    await this.service.excluir(id, profId);
  }
}

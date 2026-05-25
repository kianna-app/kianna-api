import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfissionaisService } from './profissionais.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

@ApiTags('profissionais')
@Controller('api/profissionais')
export class ProfissionaisController {
  private readonly logger = new Logger(ProfissionaisController.name);

  constructor(private readonly service: ProfissionaisService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Dados do profissional logado' })
  me(@CurrentUser('id') userId: string | undefined) {
    if (!userId) throw new UnauthorizedException();
    return this.service.porUserId(userId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Atualizar perfil do profissional logado' })
  atualizarMe(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: AtualizarPerfilDto,
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.service.atualizarPorUserId(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: 'Desativar (soft-delete) conta do profissional logado',
  })
  async excluirMe(
    @CurrentUser('id') userId: string | undefined,
  ): Promise<void> {
    if (!userId) throw new UnauthorizedException();
    await this.service.desativarPorUserId(userId);
    this.logger.log(`Conta desativada (soft-delete) | user_id=${userId}`);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Dados públicos do profissional por slug' })
  porSlug(@Param('slug') slug: string) {
    return this.service.porSlug(slug);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';
import { AtualizarPerfilAdminDto } from './dto/atualizar-perfil-admin.dto';
import { CriarProfissionalDto } from './dto/criar-profissional.dto';
import { AlterarPlanoDto } from './dto/alterar-plano.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('profissionais')
  @ApiOperation({ summary: 'Listar profissionais (admin)' })
  listar(@Query('incluirInativos') incluirInativos?: string) {
    return this.service.listarProfissionais(incluirInativos === 'true');
  }

  @Get('profissionais/:id')
  @ApiOperation({
    summary: 'Buscar profissional por ID com credenciais completas (admin)',
  })
  buscar(@Param('id') id: string) {
    return this.service.buscarProfissional(id);
  }

  @Post('profissionais')
  @ApiOperation({ summary: 'Criar profissional pré-cadastrado (admin)' })
  criar(@Body() dto: CriarProfissionalDto) {
    return this.service.criarProfissional(dto);
  }

  @Put('profissionais/:id')
  @ApiOperation({ summary: 'Atualizar perfil do profissional (admin)' })
  atualizarPerfil(
    @Param('id') id: string,
    @Body() dto: AtualizarPerfilAdminDto,
  ) {
    return this.service.atualizarPerfil(id, dto);
  }

  @Put('profissionais/:id/whatsapp')
  @ApiOperation({
    summary: 'Atualizar credenciais Z-API do profissional (admin)',
  })
  atualizarWhatsapp(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsappDto,
    @CurrentUser('profissional_id') actorProfissionalId: string | undefined,
  ) {
    return this.service.atualizarWhatsapp(id, dto, actorProfissionalId);
  }

  @Delete('profissionais/:id')
  @ApiOperation({ summary: 'Soft-delete (arquivar) profissional (admin)' })
  arquivar(@Param('id') id: string) {
    return this.service.arquivarProfissional(id);
  }

  @Post('profissionais/:id/restaurar')
  @ApiOperation({ summary: 'Restaurar profissional arquivado (admin)' })
  restaurar(@Param('id') id: string) {
    return this.service.restaurarProfissional(id);
  }

  @Put('profissionais/:id/plano')
  @ApiOperation({
    summary:
      'Alterar plano do profissional (admin) — substitui o fluxo de pagamento enquanto Stripe não existe',
  })
  alterarPlano(
    @Param('id') id: string,
    @Body() dto: AlterarPlanoDto,
    @CurrentUser('id') actorId: string | undefined,
    @CurrentUser('profissional_id') actorProfissionalId: string | undefined,
  ) {
    if (!actorId) throw new UnauthorizedException();
    return this.service.alterarPlano(id, dto.plano, actorId, actorProfissionalId);
  }
}

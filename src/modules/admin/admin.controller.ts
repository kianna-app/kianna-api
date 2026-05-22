import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('profissionais')
  @ApiOperation({ summary: 'Listar todos os profissionais (admin)' })
  listar() {
    return this.service.listarProfissionais();
  }

  @Get('profissionais/:id')
  @ApiOperation({ summary: 'Buscar profissional por ID com credenciais completas (admin)' })
  buscar(@Param('id') id: string) {
    return this.service.buscarProfissional(id);
  }

  @Put('profissionais/:id/whatsapp')
  @ApiOperation({ summary: 'Atualizar credenciais Z-API do profissional (admin)' })
  atualizarWhatsapp(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsappDto,
  ) {
    return this.service.atualizarWhatsapp(id, dto);
  }
}

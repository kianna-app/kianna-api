import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { WppStatus } from '../../common/constants/lembrete.constants';
import { ZapiService } from './zapi.service';

interface ProfWppRow {
  id: string;
  wpp_instance_id: string | null;
  wpp_token: string | null;
  wpp_status: WppStatus;
}

@ApiTags('whatsapp')
@Controller('api/whatsapp')
export class ZapiController {
  private readonly logger = new Logger(ZapiController.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly zapi: ZapiService,
    config: ConfigService,
  ) {
    this.supabase = createSupabaseClient(config);
  }

  @Post('qr-code')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Gerar QR Code para conectar WhatsApp' })
  async qrCode(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
  ): Promise<{ qrCode: string }> {
    const prof = await this.requireProf(profissionalId);
    const qrCode = await this.zapi.gerarQrCode(
      prof.wpp_instance_id!,
      prof.wpp_token!,
    );
    if (!qrCode) {
      throw new BadRequestException(
        'Não foi possível gerar o QR Code. Verifique o Instance ID e Token.',
      );
    }
    await this.atualizarStatus(prof.id, 'conectando');
    return { qrCode };
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Verificar status da conexão WhatsApp' })
  async status(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
  ): Promise<{ status: WppStatus }> {
    const prof = await this.requireProf(profissionalId);
    const r = await this.zapi.verificarStatus(
      prof.wpp_instance_id!,
      prof.wpp_token!,
    );
    const novoStatus: WppStatus = r.connected ? 'conectado' : 'desconectado';
    if (novoStatus !== prof.wpp_status) {
      await this.atualizarStatus(prof.id, novoStatus);
    }
    return { status: novoStatus };
  }

  @Post('desconectar')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Desconectar WhatsApp' })
  async desconectar(
    @CurrentUser('profissional_id') profissionalId: string | undefined,
  ): Promise<{ status: WppStatus }> {
    const prof = await this.requireProf(profissionalId);
    await this.zapi.desconectar(prof.wpp_instance_id!, prof.wpp_token!);
    await this.atualizarStatus(prof.id, 'desconectado');
    return { status: 'desconectado' };
  }

  private async requireProf(
    profissionalId: string | undefined,
  ): Promise<ProfWppRow> {
    if (!profissionalId)
      throw new UnauthorizedException('Profissional não vinculado');

    const { data, error } = await this.supabase
      .from('profissionais')
      .select('id, wpp_instance_id, wpp_token, wpp_status')
      .eq('id', profissionalId)
      .single<ProfWppRow>();

    if (error || !data)
      throw new NotFoundException('Profissional não encontrado');

    if (!data.wpp_instance_id || !data.wpp_token) {
      throw new BadRequestException(
        'Configure o Instance ID e o Token da Z-API antes de conectar.',
      );
    }
    return data;
  }

  private async atualizarStatus(
    profissionalId: string,
    status: WppStatus,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('profissionais')
      .update({ wpp_status: status })
      .eq('id', profissionalId);
    if (error) {
      this.logger.error(`Erro ao atualizar wpp_status: ${error.message}`);
    }
  }
}

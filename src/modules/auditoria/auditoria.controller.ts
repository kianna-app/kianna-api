import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  createSupabaseAnonClient,
  createSupabaseClient,
} from '../../config/supabase.config';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuditoriaService } from './auditoria.service';
import { RegistrarAuthEventoDto } from './dto/registrar-auth-evento.dto';
import { AuditoriaAcao, AuditoriaRecurso } from './auditoria.types';

@ApiExcludeController()
@Controller('api/auditoria')
export class AuditoriaController {
  constructor(
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Registra eventos de autenticação disparados pelo frontend (Supabase Auth).
   * Endpoint público: `login_falha` ocorre antes de existir sessão. Para os
   * demais o frontend envia Bearer token e o user_id é resolvido a partir dele.
   * Falha-silenciosa: nunca derruba o fluxo do frontend.
   */
  @Post('auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrarAuth(
    @Body() dto: RegistrarAuthEventoDto,
    @Req() req: Request,
  ): Promise<void> {
    const ip = this.extrairIp(req);
    const recurso: AuditoriaRecurso =
      dto.acao === 'exclusao_conta' || dto.acao === 'alteracao_senha'
        ? 'profissional'
        : 'sessao';

    const atorId =
      dto.acao === 'login_falha' ? null : await this.resolverProfissionalId(req);

    void this.auditoria.registrar({
      ator_id: atorId,
      ator_tipo: 'profissional',
      acao: dto.acao as AuditoriaAcao,
      recurso,
      detalhes: dto.motivo ? { motivo: dto.motivo } : null,
      ip,
      resultado: dto.acao === 'login_falha' ? 'falha' : 'sucesso',
    });
  }

  private async resolverProfissionalId(req: Request): Promise<string | null> {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;
    if (!token) return null;

    try {
      const anon = createSupabaseAnonClient(this.config);
      const { data, error } = await anon.auth.getUser(token);
      if (error || !data.user) return null;

      const admin = createSupabaseClient(this.config);
      const { data: prof } = await admin
        .from('profissionais')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle<{ id: string }>();
      return prof?.id ?? null;
    } catch {
      return null;
    }
  }

  private extrairIp(req: Request): string | null {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0]!.trim();
    }
    if (Array.isArray(fwd) && fwd.length > 0) {
      return fwd[0]!.trim();
    }
    return (req as AuthenticatedRequest).ip ?? req.socket?.remoteAddress ?? null;
  }
}

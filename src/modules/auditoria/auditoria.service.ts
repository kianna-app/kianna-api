import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nestjs';
import { createSupabaseClient } from '../../config/supabase.config';
import { AuditoriaEvento } from './auditoria.types';

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'wpp_token',
  'authorization',
  'access_token',
  'refresh_token',
  'cliente_wpp',
  'whatsapp',
  'telefone',
  'cpf',
  'email',
]);

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  /**
   * Registra evento de auditoria. NUNCA bloqueia o fluxo principal:
   * chame com `void this.auditoria.registrar(...)`. Falhas são
   * capturadas pelo Sentry (se configurado) e não propagam.
   */
  async registrar(evento: AuditoriaEvento): Promise<void> {
    try {
      const detalhes = this.sanitizarDetalhes(evento.detalhes);

      const { error } = await this.supabase.from('logs_auditoria').insert({
        ator_id: evento.ator_id ?? null,
        ator_tipo: evento.ator_tipo,
        acao: evento.acao,
        recurso: evento.recurso,
        recurso_id: evento.recurso_id ?? null,
        detalhes,
        ip: evento.ip ?? null,
        resultado: evento.resultado,
      });

      if (error) {
        this.logger.warn(
          `Falha ao registrar auditoria (${evento.acao}): ${error.message}`,
        );
        Sentry.captureException(
          new Error(`Auditoria insert falhou: ${error.message}`),
          {
            tags: { acao: evento.acao, recurso: evento.recurso },
          },
        );
      }
    } catch (err) {
      this.logger.warn(
        `Erro inesperado ao registrar auditoria (${evento.acao})`,
      );
      Sentry.captureException(err);
    }
  }

  private sanitizarDetalhes(
    detalhes: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!detalhes) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(detalhes)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) continue;
      out[k] = v;
    }
    return out;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

interface ProfLembrete {
  id: string;
  lembrete_horas: number;
  cancelamento_auto_cliente: boolean;
}

interface AgendamentoLembrete {
  id: string;
  profissional_id: string;
  servico_id: string | null;
  cliente_nome: string;
  cliente_wpp: string;
  data_hora: string;
}

/**
 * Roda a cada 15 minutos. Para cada profissional com `lembrete_horas` configurado
 * e WhatsApp conectado, busca agendamentos confirmados dentro da janela
 * `[agora + lembrete - 15min, agora + lembrete + 15min]` que ainda não tiveram
 * lembrete enviado, e dispara o WhatsApp.
 *
 * A janela de ±15min compensa o intervalo entre execuções do cron.
 */
@Injectable()
export class LembretesService {
  private readonly logger = new Logger(LembretesService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly notificacoes: NotificacoesService,
    config: ConfigService,
  ) {
    this.supabase = createSupabaseClient(config);
  }

  // Roda a cada 15 minutos (segundo 0)
  @Cron('0 */15 * * * *')
  async tick(): Promise<void> {
    this.logger.log('Verificando lembretes…');

    const { data: profs, error } = await this.supabase
      .from('profissionais')
      .select('id, lembrete_horas, cancelamento_auto_cliente')
      .not('lembrete_horas', 'is', null)
      .eq('wpp_status', 'conectado');

    if (error) {
      this.logger.error(`Erro ao buscar profissionais: ${error.message}`);
      return;
    }
    if (!profs?.length) return;

    for (const prof of profs as ProfLembrete[]) {
      try {
        await this.processarProfissional(prof);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`Erro no profissional ${prof.id}: ${msg}`);
      }
    }
  }

  private async processarProfissional(prof: ProfLembrete): Promise<void> {
    const agora = Date.now();
    const offsetMs = prof.lembrete_horas * 3_600_000;
    const janelaInicio = new Date(agora + offsetMs - 15 * 60_000).toISOString();
    const janelaFim = new Date(agora + offsetMs + 15 * 60_000).toISOString();

    const { data: ags, error } = await this.supabase
      .from('agendamentos')
      .select(
        'id, profissional_id, servico_id, cliente_nome, cliente_wpp, data_hora',
      )
      .eq('profissional_id', prof.id)
      .eq('status', 'confirmado')
      .eq('lembrete_enviado', false)
      .gte('data_hora', janelaInicio)
      .lte('data_hora', janelaFim);

    if (error) {
      this.logger.error(`Erro ao buscar agendamentos: ${error.message}`);
      return;
    }
    if (!ags?.length) return;

    this.logger.log(
      `${ags.length} lembrete(s) para profissional ${prof.id} (janela ${janelaInicio} → ${janelaFim})`,
    );

    for (const ag of ags as AgendamentoLembrete[]) {
      const servico_nome = await this.nomeServico(ag.servico_id);

      const enviado = await this.notificacoes.enviarLembrete({
        agendamento_id: ag.id,
        profissional_id: ag.profissional_id,
        cliente_wpp: ag.cliente_wpp,
        cliente_nome: ag.cliente_nome,
        servico_nome,
        data_hora: ag.data_hora,
        cancelamento_auto: prof.cancelamento_auto_cliente,
      });

      if (enviado) {
        const { error: updErr } = await this.supabase
          .from('agendamentos')
          .update({ lembrete_enviado: true })
          .eq('id', ag.id);
        if (updErr) {
          this.logger.error(
            `Erro ao marcar lembrete_enviado=${ag.id}: ${updErr.message}`,
          );
        }
      } else {
        this.logger.warn(`Falha ao enviar lembrete do agendamento ${ag.id}`);
      }
    }
  }

  private async nomeServico(servicoId: string | null): Promise<string> {
    if (!servicoId) return 'Serviço';
    const { data } = await this.supabase
      .from('servicos')
      .select('nome')
      .eq('id', servicoId)
      .maybeSingle<{ nome: string }>();
    return data?.nome ?? 'Serviço';
  }
}

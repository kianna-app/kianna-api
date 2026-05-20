import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

interface ProfResposta {
  id: string;
  cancelamento_auto_cliente: boolean;
}

interface AgendamentoResposta {
  id: string;
  profissional_id: string;
  servico_id: string | null;
  cliente_nome: string;
  cliente_wpp: string;
  data_hora: string;
  status: string;
}

/**
 * Processa respostas do cliente recebidas via webhook Z-API.
 *
 *  - "1" / "sim" / "confirmar"  → marca `confirmacao_presenca = 'confirmou'`
 *  - "2" / "não" / "cancelar"   → cancela agendamento (se `cancelamento_auto_cliente`),
 *                                  ou ignora caso a opção esteja desabilitada
 *
 * Resoluções obrigatórias:
 *  - achar o profissional pela `wpp_instance_id` da Z-API
 *  - achar o agendamento certo entre vários possíveis (compara últimos 8 dígitos do telefone)
 *  - ignorar respostas em agendamentos que ainda não receberam lembrete
 */
@Injectable()
export class RespostasService {
  private readonly logger = new Logger(RespostasService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly notificacoes: NotificacoesService,
    config: ConfigService,
  ) {
    this.supabase = createSupabaseClient(config);
  }

  async processarResposta(
    instanceId: string,
    phone: string,
    texto: string,
  ): Promise<void> {
    const intencao = this.classificar(texto);
    if (!intencao) {
      this.logger.debug(`Resposta ignorada (${phone}): "${texto}"`);
      return;
    }

    const prof = await this.acharProfissional(instanceId);
    if (!prof) return;

    const ag = await this.acharAgendamento(prof.id, phone);
    if (!ag) {
      this.logger.debug(`Sem agendamento aguardando resposta para ${phone}`);
      return;
    }

    if (intencao === 'confirmar') {
      await this.confirmar(ag);
      return;
    }

    if (intencao === 'cancelar') {
      if (!prof.cancelamento_auto_cliente) {
        this.logger.log(
          `Cancelamento ignorado (auto desabilitado) — agendamento ${ag.id}`,
        );
        return;
      }
      await this.cancelar(ag);
    }
  }

  /** Atualiza wpp_status do profissional dado o instanceId. Usado por outros callbacks. */
  async atualizarStatusConexao(
    instanceId: string,
    connected: boolean,
  ): Promise<void> {
    const status = connected ? 'conectado' : 'desconectado';
    const { error } = await this.supabase
      .from('profissionais')
      .update({ wpp_status: status })
      .eq('wpp_instance_id', instanceId);
    if (error) {
      this.logger.error(`Erro ao atualizar wpp_status: ${error.message}`);
    }
  }

  // ─────────── helpers ───────────

  private classificar(texto: string): 'confirmar' | 'cancelar' | null {
    const t = texto
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9áéíóúãõâêôç ]/g, '');
    if (!t) return null;
    if (
      t === '1' ||
      t === 'sim' ||
      t === 's' ||
      t.includes('confirmar') ||
      t.includes('confirmo')
    ) {
      return 'confirmar';
    }
    if (
      t === '2' ||
      t === 'nao' ||
      t === 'não' ||
      t === 'n' ||
      t.includes('cancelar') ||
      t.includes('cancela')
    ) {
      return 'cancelar';
    }
    return null;
  }

  private async acharProfissional(
    instanceId: string,
  ): Promise<ProfResposta | null> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('id, cancelamento_auto_cliente')
      .eq('wpp_instance_id', instanceId)
      .maybeSingle<ProfResposta>();

    if (error) {
      this.logger.error(`Erro ao buscar profissional: ${error.message}`);
      return null;
    }
    if (!data) {
      this.logger.warn(
        `Profissional não encontrado para instance ${instanceId}`,
      );
      return null;
    }
    return data;
  }

  /**
   * Busca agendamentos confirmados com lembrete enviado e sem confirmação,
   * e seleciona o que casa com o telefone do remetente.
   */
  private async acharAgendamento(
    profissionalId: string,
    phone: string,
  ): Promise<AgendamentoResposta | null> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .select(
        'id, profissional_id, servico_id, cliente_nome, cliente_wpp, data_hora, status',
      )
      .eq('profissional_id', profissionalId)
      .eq('status', 'confirmado')
      .eq('lembrete_enviado', true)
      .is('confirmacao_presenca', null)
      .order('data_hora', { ascending: true })
      .limit(10);

    if (error) {
      this.logger.error(`Erro ao buscar agendamentos: ${error.message}`);
      return null;
    }
    if (!data?.length) return null;

    const norm = (s: string) => s.replace(/\D/g, '').replace(/^55/, '');
    const phoneDigits = norm(phone);
    const ultimos = phoneDigits.slice(-8);

    return (
      (data as AgendamentoResposta[]).find((a) => {
        const ag = norm(a.cliente_wpp);
        return (
          ag === phoneDigits || ag.endsWith(ultimos) || phoneDigits.endsWith(ag)
        );
      }) ?? null
    );
  }

  private async confirmar(ag: AgendamentoResposta): Promise<void> {
    const { error } = await this.supabase
      .from('agendamentos')
      .update({ confirmacao_presenca: 'confirmou' })
      .eq('id', ag.id);
    if (error) {
      this.logger.error(`Erro ao confirmar presença: ${error.message}`);
      return;
    }
    this.logger.log(`Presença confirmada — agendamento ${ag.id}`);
  }

  private async cancelar(ag: AgendamentoResposta): Promise<void> {
    const { error } = await this.supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        confirmacao_presenca: 'cancelou',
      })
      .eq('id', ag.id);
    if (error) {
      this.logger.error(`Erro ao cancelar agendamento: ${error.message}`);
      return;
    }
    this.logger.log(`Cancelamento automático — agendamento ${ag.id}`);

    const servico_nome = await this.nomeServico(ag.servico_id);

    try {
      await this.notificacoes.notificarCancelamentoCliente({
        profissional_id: ag.profissional_id,
        cliente_nome: ag.cliente_nome,
        servico_nome,
        data_hora: ag.data_hora,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Erro ao notificar cancelamento: ${msg}`);
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

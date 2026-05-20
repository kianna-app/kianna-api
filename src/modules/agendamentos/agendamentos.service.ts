import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AgendamentoStatus } from './dto/atualizar-status.dto';
import { ReagendarDto } from './dto/reagendar.dto';
import { AtualizarAgendamentoDto } from './dto/atualizar-agendamento.dto';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

export interface Agendamento {
  id: string;
  profissional_id: string;
  servico_id: string;
  cliente_nome: string;
  cliente_wpp: string;
  data_hora: string;
  status: AgendamentoStatus;
  motivo_recusa?: string | null;
  observacoes?: string | null;
  agendamento_origem_id?: string | null;
  criado_em?: string;
}

export interface AgendamentoComServico extends Agendamento {
  servico: {
    id: string;
    nome: string;
    duracao_min: number;
    preco: number;
    modalidade: string;
  } | null;
}

@Injectable()
export class AgendamentosService {
  private readonly logger = new Logger(AgendamentosService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    config: ConfigService,
    private readonly notificacoes: NotificacoesService,
  ) {
    this.supabase = createSupabaseClient(config);
  }

  /** Busca o nome do serviço (com fallback) — usado nas mensagens. */
  private async nomeServico(
    servicoId: string | null | undefined,
  ): Promise<string> {
    if (!servicoId) return 'Serviço';
    const { data } = await this.supabase
      .from('servicos')
      .select('nome')
      .eq('id', servicoId)
      .maybeSingle<{ nome: string }>();
    return data?.nome ?? 'Serviço';
  }

  async listarPorPeriodo(
    profissionalId: string,
    inicio?: string,
    fim?: string,
  ): Promise<AgendamentoComServico[]> {
    let query = this.supabase
      .from('agendamentos')
      .select(
        '*, servico:servicos ( id, nome, duracao_min, preco, modalidade )',
      )
      .eq('profissional_id', profissionalId)
      .order('data_hora', { ascending: true });

    if (inicio) query = query.gte('data_hora', inicio);
    if (fim) query = query.lt('data_hora', fim);

    const { data, error } = await query;
    if (error)
      throw new InternalServerErrorException(
        `Erro ao listar agendamentos: ${error.message}`,
      );
    return (data ?? []) as AgendamentoComServico[];
  }

  async criar(dto: CriarAgendamentoDto): Promise<Agendamento> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .insert({ ...dto, status: 'pendente' })
      .select()
      .single<Agendamento>();

    if (error || !data)
      throw new InternalServerErrorException(
        `Erro ao criar agendamento: ${error?.message ?? 'desconhecido'}`,
      );

    // WhatsApp: avisa profissional (não bloqueia resposta)
    void this.nomeServico(dto.servico_id)
      .then((servico_nome) =>
        this.notificacoes.notificarNovaSolicitacao({
          profissional_id: dto.profissional_id,
          cliente_nome: dto.cliente_nome,
          servico_nome,
          data_hora: dto.data_hora,
        }),
      )
      .catch((e: unknown) => this.logErroNotificacao('nova-solicitacao', e));

    return data;
  }

  async detalhe(id: string): Promise<Agendamento> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .select('*')
      .eq('id', id)
      .single<Agendamento>();

    if (error || !data)
      throw new NotFoundException('Agendamento não encontrado');
    return data;
  }

  async atualizarStatus(
    id: string,
    status: AgendamentoStatus,
    motivo_recusa?: string,
  ): Promise<Agendamento> {
    const payload: Record<string, unknown> = { status };
    if (status === 'recusado' && motivo_recusa !== undefined) {
      payload['motivo_recusa'] = motivo_recusa;
    }

    const { data, error } = await this.supabase
      .from('agendamentos')
      .update(payload)
      .eq('id', id)
      .select()
      .single<Agendamento>();

    if (error || !data)
      throw new NotFoundException('Agendamento não encontrado');

    // WhatsApp: dispara notificação correspondente (sem bloquear resposta)
    void this.dispararNotificacaoStatus(data, status, motivo_recusa);

    return data;
  }

  private async dispararNotificacaoStatus(
    ag: Agendamento,
    status: AgendamentoStatus,
    motivo_recusa?: string,
  ): Promise<void> {
    try {
      if (
        status !== 'confirmado' &&
        status !== 'recusado' &&
        status !== 'cancelado' &&
        status !== 'reagendado'
      ) {
        return;
      }

      const base = {
        profissional_id: ag.profissional_id,
        cliente_wpp: ag.cliente_wpp,
        cliente_nome: ag.cliente_nome,
        data_hora: ag.data_hora,
      };

      if (status === 'reagendado') {
        // Profissional iniciou reagendamento → envia link ao cliente
        await this.notificacoes.notificarReagendamento({
          profissional_id: ag.profissional_id,
          cliente_wpp: ag.cliente_wpp,
          cliente_nome: ag.cliente_nome,
          agendamento_id: ag.id,
        });
        return;
      }

      const servico_nome = await this.nomeServico(ag.servico_id);

      if (status === 'confirmado') {
        await this.notificacoes.notificarConfirmacao({ ...base, servico_nome });
      } else if (status === 'recusado') {
        await this.notificacoes.notificarRecusa({
          ...base,
          servico_nome,
          motivo_recusa,
        });
      } else if (status === 'cancelado') {
        await this.notificacoes.notificarCancelamentoProfissional({
          ...base,
          servico_nome,
        });
      }
    } catch (e: unknown) {
      this.logErroNotificacao(`status-${status}`, e);
    }
  }

  private logErroNotificacao(contexto: string, e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    this.logger.error(
      `Falha ao enviar notificação WhatsApp (${contexto}): ${msg}`,
    );
  }

  async contarPendentes(profissionalUserId: string): Promise<number> {
    const { data: prof } = await this.supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', profissionalUserId)
      .single<{ id: string }>();

    if (!prof) return 0;

    const { count, error } = await this.supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('profissional_id', prof.id)
      .eq('status', 'pendente');

    if (error) return 0;
    return count ?? 0;
  }

  async reagendar(
    profissionalId: string,
    dto: ReagendarDto,
  ): Promise<{ id: string }> {
    const { data: origem, error: origemErr } = await this.supabase
      .from('agendamentos')
      .select('id, profissional_id')
      .eq('id', dto.agendamento_origem_id)
      .single<{ id: string; profissional_id: string }>();

    if (origemErr || !origem)
      throw new NotFoundException('Agendamento original não encontrado');

    if (origem.profissional_id !== dto.profissional_id) {
      throw new BadRequestException(
        'Profissional do agendamento de origem diverge do payload',
      );
    }

    const { error: updErr } = await this.supabase
      .from('agendamentos')
      .update({ status: 'reagendado' })
      .eq('id', origem.id);

    if (updErr)
      throw new InternalServerErrorException(
        `Erro ao atualizar origem: ${updErr.message}`,
      );

    const { data: novo, error: insErr } = await this.supabase
      .from('agendamentos')
      .insert({
        profissional_id: dto.profissional_id,
        servico_id: dto.servico_id,
        cliente_nome: dto.cliente_nome,
        cliente_wpp: dto.cliente_wpp,
        data_hora: dto.data_hora,
        status: 'pendente',
        agendamento_origem_id: origem.id,
      })
      .select('id')
      .single<{ id: string }>();

    if (insErr || !novo) {
      // rollback
      await this.supabase
        .from('agendamentos')
        .update({ status: 'confirmado' })
        .eq('id', origem.id);

      throw new InternalServerErrorException(
        `Erro ao criar reagendamento: ${insErr?.message ?? 'desconhecido'}`,
      );
    }

    // WhatsApp: cliente concluiu reagendamento → avisa profissional (sem bloquear)
    void this.nomeServico(dto.servico_id)
      .then((servico_nome) =>
        this.notificacoes.notificarNovaSolicitacao({
          profissional_id: dto.profissional_id,
          cliente_nome: dto.cliente_nome,
          servico_nome,
          data_hora: dto.data_hora,
        }),
      )
      .catch((e: unknown) => this.logErroNotificacao('reagendamento-novo', e));

    return novo;
  }

  async atualizar(
    profissionalId: string,
    id: string,
    dto: AtualizarAgendamentoDto,
  ): Promise<Agendamento> {
    if (Object.keys(dto).length === 0) {
      return this.detalhe(id);
    }
    const { data, error } = await this.supabase
      .from('agendamentos')
      .update(dto)
      .eq('id', id)
      .eq('profissional_id', profissionalId)
      .select()
      .single<Agendamento>();

    if (error || !data)
      throw new NotFoundException('Agendamento não encontrado');
    return data;
  }

  async excluir(profissionalId: string, id: string): Promise<{ id: string }> {
    const { error } = await this.supabase
      .from('agendamentos')
      .delete()
      .eq('id', id)
      .eq('profissional_id', profissionalId);

    if (error)
      throw new InternalServerErrorException(
        `Erro ao excluir agendamento: ${error.message}`,
      );
    return { id };
  }

  async listarConfirmadosPublico(
    profissionalId: string,
    de: string,
    ate: string,
  ): Promise<Array<{ data_hora: string }>> {
    const { data, error } = await this.supabase
      .from('agendamentos_publicos')
      .select('data_hora')
      .eq('profissional_id', profissionalId)
      .eq('status', 'confirmado')
      .gte('data_hora', `${de}T00:00:00`)
      .lte('data_hora', `${ate}T23:59:59`);
    if (error)
      throw new InternalServerErrorException(
        `Erro ao listar agendamentos confirmados: ${error.message}`,
      );
    return data ?? [];
  }

  async buscarPublicoPorId(
    id: string,
  ): Promise<{ id: string; servico_id: string | null } | null> {
    const { data } = await this.supabase
      .from('agendamentos_publicos')
      .select('id, servico_id')
      .eq('id', id)
      .maybeSingle<{ id: string; servico_id: string | null }>();
    return data ?? null;
  }

  async finalizarVencidos(profissionalId: string): Promise<{ count: number }> {
    const agora = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('agendamentos')
      .update({ status: 'finalizado' })
      .eq('profissional_id', profissionalId)
      .eq('status', 'confirmado')
      .lt('data_hora', agora)
      .select('id');

    if (error)
      throw new InternalServerErrorException(
        `Erro ao finalizar vencidos: ${error.message}`,
      );
    return { count: (data ?? []).length };
  }
}

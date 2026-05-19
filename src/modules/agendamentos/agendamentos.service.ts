import {
  Injectable,
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
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
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
    return (data ?? []) as unknown as AgendamentoComServico[];
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
    return data;
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

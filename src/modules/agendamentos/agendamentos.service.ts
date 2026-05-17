import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AgendamentoStatus } from './dto/atualizar-status.dto';

export interface Agendamento {
  id: string;
  profissional_id: string;
  servico_id: string;
  cliente_nome: string;
  cliente_wpp: string;
  data_hora: string;
  status: AgendamentoStatus;
  criado_em?: string;
}

@Injectable()
export class AgendamentosService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
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
  ): Promise<Agendamento> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .update({ status })
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
}

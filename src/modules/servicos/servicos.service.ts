import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CriarServicoDto } from './dto/criar-servico.dto';
import { AtualizarServicoDto } from './dto/atualizar-servico.dto';

export interface Servico {
  id: string;
  profissional_id: string;
  nome: string;
  duracao_min: number;
  preco: number;
  modalidade: string;
  ativo: boolean;
  created_at?: string;
}

@Injectable()
export class ServicosService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  private requireProf(profissionalId?: string): string {
    if (!profissionalId)
      throw new UnauthorizedException('Profissional não vinculado ao usuário');
    return profissionalId;
  }

  async listar(profissionalId?: string): Promise<Servico[]> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('servicos')
      .select('*')
      .eq('profissional_id', profId)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as Servico[];
  }

  async buscarPorId(id: string, profissionalId?: string): Promise<Servico> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('servicos')
      .select('*')
      .eq('id', id)
      .eq('profissional_id', profId)
      .single<Servico>();
    if (error || !data) throw new NotFoundException('Serviço não encontrado');
    return data;
  }

  async criar(
    profissionalId: string | undefined,
    dto: CriarServicoDto,
  ): Promise<Servico> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('servicos')
      .insert({ ativo: true, ...dto, profissional_id: profId })
      .select()
      .single<Servico>();
    if (error || !data) throw new InternalServerErrorException(error?.message);
    return data;
  }

  async atualizar(
    id: string,
    profissionalId: string | undefined,
    dto: AtualizarServicoDto,
  ): Promise<Servico> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('servicos')
      .update(dto)
      .eq('id', id)
      .eq('profissional_id', profId)
      .select()
      .single<Servico>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Serviço não encontrado');
    return data;
  }

  async excluir(id: string, profissionalId?: string): Promise<void> {
    const profId = this.requireProf(profissionalId);
    const { error } = await this.supabase
      .from('servicos')
      .delete()
      .eq('id', id)
      .eq('profissional_id', profId);
    if (error) {
      if (error.code === '23503') {
        throw new ForbiddenException(
          'Não é possível excluir: serviço possui agendamentos vinculados.',
        );
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async listarAtivos(profissionalId: string): Promise<Partial<Servico>[]> {
    const { data, error } = await this.supabase
      .from('servicos')
      .select('id, nome, duracao_min, preco, modalidade')
      .eq('profissional_id', profissionalId)
      .eq('ativo', true)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as Partial<Servico>[];
  }
}

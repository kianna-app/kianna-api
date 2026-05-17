import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CriarDisponibilidadeDto } from './dto/criar-disponibilidade.dto';
import { AtualizarDisponibilidadeDto } from './dto/atualizar-disponibilidade.dto';

export interface Disponibilidade {
  id: string;
  profissional_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_min: number;
  capacidade?: number | null;
}

@Injectable()
export class DisponibilidadesService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  private requireProf(profissionalId?: string): string {
    if (!profissionalId)
      throw new UnauthorizedException('Profissional não vinculado ao usuário');
    return profissionalId;
  }

  async listar(profissionalId?: string): Promise<Disponibilidade[]> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('disponibilidades')
      .select('*')
      .eq('profissional_id', profId)
      .order('dia_semana')
      .order('hora_inicio');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as Disponibilidade[];
  }

  async criar(
    profissionalId: string | undefined,
    dto: CriarDisponibilidadeDto,
  ): Promise<Disponibilidade> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('disponibilidades')
      .insert({ ...dto, profissional_id: profId })
      .select()
      .single<Disponibilidade>();
    if (error || !data) throw new InternalServerErrorException(error?.message);
    return data;
  }

  async atualizar(
    id: string,
    profissionalId: string | undefined,
    dto: AtualizarDisponibilidadeDto,
  ): Promise<Disponibilidade> {
    const profId = this.requireProf(profissionalId);
    const { data, error } = await this.supabase
      .from('disponibilidades')
      .update(dto)
      .eq('id', id)
      .eq('profissional_id', profId)
      .select()
      .single<Disponibilidade>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Disponibilidade não encontrada');
    return data;
  }

  async excluir(id: string, profissionalId?: string): Promise<void> {
    const profId = this.requireProf(profissionalId);
    const { error } = await this.supabase
      .from('disponibilidades')
      .delete()
      .eq('id', id)
      .eq('profissional_id', profId);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async listarPorProfissional(
    profissionalId: string,
  ): Promise<Partial<Disponibilidade>[]> {
    const { data, error } = await this.supabase
      .from('disponibilidades')
      .select('dia_semana, hora_inicio, hora_fim, intervalo_min, capacidade')
      .eq('profissional_id', profissionalId)
      .order('dia_semana')
      .order('hora_inicio');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as Partial<Disponibilidade>[];
  }
}

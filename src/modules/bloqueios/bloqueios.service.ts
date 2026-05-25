import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CriarBloqueioDto } from './dto/criar-bloqueio.dto';

export interface Bloqueio {
  id: string;
  profissional_id: string;
  data: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  motivo?: string | null;
}

@Injectable()
export class BloqueiosService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  private requireProf(profissionalId?: string): string {
    if (!profissionalId)
      throw new UnauthorizedException('Profissional não vinculado ao usuário');
    return profissionalId;
  }

  async listar(profissionalId?: string): Promise<Bloqueio[]> {
    const profId = this.requireProf(profissionalId);
    const hoje = new Date().toISOString().split('T')[0];
    const { data, error } = await this.supabase
      .from('bloqueios')
      .select('*')
      .eq('profissional_id', profId)
      .gte('data', hoje)
      .order('data');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as Bloqueio[];
  }

  async criar(
    profissionalId: string | undefined,
    dto: CriarBloqueioDto,
  ): Promise<Bloqueio> {
    const profId = this.requireProf(profissionalId);

    if (
      (dto.hora_inicio && !dto.hora_fim) ||
      (!dto.hora_inicio && dto.hora_fim)
    ) {
      throw new BadRequestException(
        'Informe hora_inicio E hora_fim, ou nenhum dos dois.',
      );
    }
    if (dto.hora_inicio && dto.hora_fim && dto.hora_fim <= dto.hora_inicio) {
      throw new BadRequestException(
        'hora_fim deve ser posterior a hora_inicio.',
      );
    }

    const { data, error } = await this.supabase
      .from('bloqueios')
      .insert({ ...dto, profissional_id: profId })
      .select()
      .single<Bloqueio>();
    if (error || !data) throw new InternalServerErrorException(error?.message);
    return data;
  }

  async excluir(id: string, profissionalId?: string): Promise<void> {
    const profId = this.requireProf(profissionalId);
    const { error } = await this.supabase
      .from('bloqueios')
      .delete()
      .eq('id', id)
      .eq('profissional_id', profId);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async listarPorPeriodo(
    profissionalId: string,
    dataInicio: string,
    dataFim: string,
  ): Promise<Partial<Bloqueio>[]> {
    const { data, error } = await this.supabase
      .from('bloqueios')
      .select('data, hora_inicio, hora_fim')
      .eq('profissional_id', profissionalId)
      .gte('data', dataInicio)
      .lte('data', dataFim);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}

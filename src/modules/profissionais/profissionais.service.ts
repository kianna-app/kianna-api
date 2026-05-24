import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

export interface Profissional {
  id: string;
  user_id: string;
  slug: string;
  nome: string;
  whatsapp?: string;
  foto_url?: string | null;
  especialidade?: string | null;
  bio?: string | null;
  role?: string;
  antecedencia_minima_horas?: number;
  antecedencia_maxima_dias?: number | null;
  timezone?: string;
  ativo?: boolean;
  onboarding_concluido?: boolean;
  [key: string]: unknown;
}

const PUBLIC_FIELDS = [
  'id',
  'nome',
  'slug',
  'foto_url',
  'especialidade',
  'bio',
  'whatsapp',
  'endereco_cep',
  'endereco_rua',
  'endereco_numero',
  'endereco_complemento',
  'endereco_bairro',
  'endereco_cidade',
  'endereco_estado',
  'instagram_url',
  'facebook_url',
  'twitter_url',
  'youtube_url',
  'links_personalizados',
  'antecedencia_minima_horas',
  'antecedencia_maxima_dias',
  'timezone',
].join(', ');

@Injectable()
export class ProfissionaisService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  async porUserId(userId: string): Promise<Profissional> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('*')
      .eq('user_id', userId)
      .single<Profissional>();

    if (error || !data)
      throw new NotFoundException('Profissional não encontrado');

    const { data: authData } = await this.supabase.auth.admin.getUserById(userId);
    if (authData?.user?.email) {
      (data as Profissional & { email?: string }).email = authData.user.email;
    }
    return data;
  }

  async desativarPorUserId(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('profissionais')
      .update({ ativo: false })
      .eq('user_id', userId);

    if (error)
      throw new InternalServerErrorException(
        `Erro ao desativar conta: ${error.message}`,
      );
  }

  async porSlug(slug: string): Promise<Profissional> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select(PUBLIC_FIELDS)
      .eq('slug', slug)
      .eq('ativo', true)
      .single<Profissional>();

    if (error || !data)
      throw new NotFoundException('Profissional não encontrado');
    return data;
  }

  async porSlugInterno(slug: string): Promise<Profissional | null> {
    const { data } = await this.supabase
      .from('profissionais')
      .select('*')
      .eq('slug', slug)
      .eq('ativo', true)
      .maybeSingle<Profissional>();
    return data ?? null;
  }

  filtrarCamposPublicos(prof: Profissional): Partial<Profissional> {
    const campos = PUBLIC_FIELDS.split(', ').map((c) => c.trim());
    const out: Record<string, unknown> = {};
    for (const campo of campos) {
      if (campo in prof) out[campo] = prof[campo];
    }
    return out;
  }

  async buscarRedirectSlug(slugAntigo: string): Promise<string | null> {
    const agora = new Date().toISOString();
    const { data: redirect } = await this.supabase
      .from('slug_redirects')
      .select('profissional_id')
      .eq('slug_antigo', slugAntigo)
      .gt('expira_em', agora)
      .maybeSingle<{ profissional_id: string }>();
    if (!redirect) return null;

    const { data: prof } = await this.supabase
      .from('profissionais')
      .select('slug')
      .eq('id', redirect.profissional_id)
      .maybeSingle<{ slug: string }>();
    return prof?.slug ?? null;
  }

  async contarAgendamentosNoMes(profissionalId: string): Promise<number> {
    const agora = new Date();
    const inicio = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      1,
    ).toISOString();
    const fim = new Date(
      agora.getFullYear(),
      agora.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).toISOString();

    const { count } = await this.supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('profissional_id', profissionalId)
      .in('status', ['pendente', 'confirmado', 'finalizado'])
      .gte('data_hora', inicio)
      .lte('data_hora', fim);
    return count ?? 0;
  }

  async atualizarPorUserId(
    userId: string,
    dto: AtualizarPerfilDto,
  ): Promise<Profissional> {
    const payload: Record<string, unknown> = { ...dto };
    if (Object.keys(payload).length === 0) {
      return this.porUserId(userId);
    }

    const { data, error } = await this.supabase
      .from('profissionais')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single<Profissional>();

    if (error || !data)
      throw new InternalServerErrorException(
        `Erro ao atualizar perfil: ${error?.message ?? 'desconhecido'}`,
      );
    return data;
  }
}

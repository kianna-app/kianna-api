import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';

export interface Profissional {
  id: string;
  user_id: string;
  slug: string;
  nome: string;
  whatsapp?: string;
  foto_url?: string | null;
  bio?: string | null;
  role?: string;
}

export type ProfissionalPublico = Pick<
  Profissional,
  'id' | 'slug' | 'nome' | 'foto_url' | 'bio' | 'whatsapp'
>;

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
    return data;
  }

  async porSlug(slug: string): Promise<ProfissionalPublico> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('id, slug, nome, foto_url, bio, whatsapp')
      .eq('slug', slug)
      .single<ProfissionalPublico>();

    if (error || !data)
      throw new NotFoundException('Profissional não encontrado');
    return data;
  }
}

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';

export interface ProfissionalRow {
  id: string;
  nome: string;
  slug: string;
  whatsapp: string;
  wpp_instance_id: string | null;
  wpp_token: string | null;
  wpp_status: string;
  created_at: string;
}

@Injectable()
export class AdminService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  async listarProfissionais() {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('id, nome, slug, whatsapp, wpp_instance_id, wpp_token, wpp_status, created_at')
      .order('nome');

    if (error) throw new InternalServerErrorException(error.message);

    return (data as ProfissionalRow[]).map((p) => ({
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      whatsapp: p.whatsapp,
      wpp_instance_id: p.wpp_instance_id,
      wpp_status: p.wpp_status,
      tem_token: !!p.wpp_token,
      created_at: p.created_at,
    }));
  }

  async buscarProfissional(id: string): Promise<ProfissionalRow> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select('id, nome, slug, whatsapp, wpp_instance_id, wpp_token, wpp_status, created_at')
      .eq('id', id)
      .single<ProfissionalRow>();

    if (error || !data) throw new NotFoundException('Profissional não encontrado');
    return data;
  }

  async atualizarWhatsapp(id: string, dto: UpdateWhatsappDto): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .from('profissionais')
      .update({
        wpp_instance_id: dto.wpp_instance_id,
        wpp_token: dto.wpp_token,
      })
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }
}

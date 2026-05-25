import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';
import { AtualizarPerfilAdminDto } from './dto/atualizar-perfil-admin.dto';
import { CriarProfissionalDto } from './dto/criar-profissional.dto';

export interface ProfissionalRow {
  id: string;
  nome: string;
  slug: string;
  whatsapp: string;
  foto_url: string | null;
  bio: string | null;
  wpp_instance_id: string | null;
  wpp_token: string | null;
  wpp_status: string;
  ativo: boolean;
  created_at: string;
}

const SELECT_COLUNAS =
  'id, nome, slug, whatsapp, foto_url, bio, wpp_instance_id, wpp_token, wpp_status, ativo, created_at';

@Injectable()
export class AdminService {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  async listarProfissionais(incluirInativos = false) {
    let query = this.supabase
      .from('profissionais')
      .select(SELECT_COLUNAS)
      .order('nome');

    if (!incluirInativos) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    return (data as ProfissionalRow[]).map((p) => ({
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      whatsapp: p.whatsapp,
      foto_url: p.foto_url,
      bio: p.bio,
      wpp_instance_id: p.wpp_instance_id,
      wpp_status: p.wpp_status,
      tem_token: !!p.wpp_token,
      ativo: p.ativo,
      created_at: p.created_at,
    }));
  }

  async buscarProfissional(id: string): Promise<ProfissionalRow> {
    const { data, error } = await this.supabase
      .from('profissionais')
      .select(SELECT_COLUNAS)
      .eq('id', id)
      .single<ProfissionalRow>();

    if (error || !data)
      throw new NotFoundException('Profissional não encontrado');
    return data;
  }

  async atualizarWhatsapp(
    id: string,
    dto: UpdateWhatsappDto,
  ): Promise<{ ok: true }> {
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

  async atualizarPerfil(
    id: string,
    dto: AtualizarPerfilAdminDto,
  ): Promise<ProfissionalRow> {
    const atual = await this.buscarProfissional(id);

    const payload: Record<string, unknown> = {};
    if (dto.nome !== undefined) payload['nome'] = dto.nome;
    if (dto.bio !== undefined) payload['bio'] = dto.bio;
    if (dto.foto_url !== undefined) payload['foto_url'] = dto.foto_url;

    if (dto.slug !== undefined && dto.slug !== atual.slug) {
      const { data: existente } = await this.supabase
        .from('profissionais')
        .select('id')
        .eq('slug', dto.slug)
        .neq('id', id)
        .maybeSingle();

      if (existente) {
        throw new ConflictException('Este slug já está em uso');
      }

      const expira = new Date();
      expira.setDate(expira.getDate() + 90);
      await this.supabase.from('slug_redirects').insert({
        slug_antigo: atual.slug,
        profissional_id: id,
        expira_em: expira.toISOString(),
      });

      payload['slug'] = dto.slug;
      payload['slug_alterado_em'] = new Date().toISOString();
    }

    if (Object.keys(payload).length === 0) return atual;

    const { data, error } = await this.supabase
      .from('profissionais')
      .update(payload)
      .eq('id', id)
      .select(SELECT_COLUNAS)
      .single<ProfissionalRow>();

    if (error || !data) {
      throw new InternalServerErrorException(
        `Erro ao atualizar perfil: ${error?.message ?? 'desconhecido'}`,
      );
    }
    return data;
  }

  async criarProfissional(dto: CriarProfissionalDto): Promise<ProfissionalRow> {
    const { data: existenteSlug } = await this.supabase
      .from('profissionais')
      .select('id')
      .eq('slug', dto.slug)
      .maybeSingle();

    if (existenteSlug) {
      throw new ConflictException('Este slug já está em uso');
    }

    // TODO: Definir fluxo de acesso do profissional (convite/magic-link/definição de senha).
    // Por ora, o registro é criado sem user_id vinculado; o profissional ainda não pode
    // logar até que esse fluxo exista. Operar pelo /admin enquanto isso.
    const { data, error } = await this.supabase
      .from('profissionais')
      .insert({
        nome: dto.nome,
        slug: dto.slug,
        whatsapp: dto.whatsapp ?? '',
        ativo: true,
        onboarding_concluido: false,
      })
      .select(SELECT_COLUNAS)
      .single<ProfissionalRow>();

    if (error || !data) {
      const msg = error?.message ?? 'desconhecido';
      if (msg.includes('user_id')) {
        throw new BadRequestException(
          'O schema atual exige user_id. Implemente o fluxo de convite do profissional antes (ver TODO em admin.service).',
        );
      }
      throw new InternalServerErrorException(
        `Erro ao criar profissional: ${msg}`,
      );
    }

    return data;
  }

  async arquivarProfissional(id: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .from('profissionais')
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  async restaurarProfissional(id: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .from('profissionais')
      .update({ ativo: true })
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }
}

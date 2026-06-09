import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';
import { AtualizarPerfilAdminDto } from './dto/atualizar-perfil-admin.dto';
import { CriarProfissionalDto } from './dto/criar-profissional.dto';
import { PlanoId } from '../planos/planos.catalog';
import { AuditoriaService } from '../auditoria/auditoria.service';

export interface ProfissionalRow {
  id: string;
  user_id: string | null;
  nome: string;
  slug: string;
  whatsapp: string;
  foto_url: string | null;
  bio: string | null;
  plano: PlanoId;
  wpp_instance_id: string | null;
  wpp_token: string | null;
  wpp_status: string;
  ativo: boolean;
  created_at: string;
  email?: string | null;
}

const SELECT_COLUNAS =
  'id, user_id, nome, slug, whatsapp, foto_url, bio, plano, wpp_instance_id, wpp_token, wpp_status, ativo, created_at';

@Injectable()
export class AdminService {
  private readonly supabase: SupabaseClient;
  private readonly logger = new Logger(AdminService.name);
  private readonly authRedirectUrl: string;

  constructor(
    config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {
    this.supabase = createSupabaseClient(config);
    const frontendUrl =
      config.get<string>('frontendUrl') ??
      config.get<string>('FRONTEND_URL') ??
      'http://localhost:4200';
    this.authRedirectUrl = `${frontendUrl.replace(/\/$/, '')}/auth/nova-senha`;
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

    const profissionais = data as ProfissionalRow[];
    const emails = await this.buscarEmailsPorUserId(
      profissionais.map((p) => p.user_id).filter((id): id is string => !!id),
    );

    return profissionais.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      nome: p.nome,
      slug: p.slug,
      email: p.user_id ? emails.get(p.user_id) ?? null : null,
      whatsapp: p.whatsapp,
      foto_url: p.foto_url,
      bio: p.bio,
      plano: p.plano,
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
    const email = data.user_id
      ? await this.buscarEmailPorUserId(data.user_id)
      : null;
    data.email = email;
    return data;
  }

  private async buscarEmailPorUserId(userId: string): Promise<string | null> {
    const { data } = await this.supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  }

  private async buscarEmailsPorUserId(
    userIds: string[],
  ): Promise<Map<string, string>> {
    const pares = await Promise.all(
      userIds.map(async (userId) => ({
        userId,
        email: await this.buscarEmailPorUserId(userId),
      })),
    );

    return new Map(
      pares
        .filter((p): p is { userId: string; email: string } => !!p.email)
        .map((p) => [p.userId, p.email]),
    );
  }

  private mensagemErroAuthSupabase(message: string | undefined): string {
    if (!message) return 'Não foi possível criar usuário no Supabase Auth.';

    const msg = message.toLowerCase();
    if (msg.includes('email address') && msg.includes('invalid')) {
      return 'E-mail inválido ou não aceito pelo provedor. Use um endereço real e válido.';
    }

    if (msg.includes('already') || msg.includes('registered')) {
      return 'Este e-mail já possui uma conta. Use outro e-mail ou resete a senha do profissional existente.';
    }

    return message;
  }

  async atualizarWhatsapp(
    id: string,
    dto: UpdateWhatsappDto,
    actorProfissionalId?: string | null,
  ): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .from('profissionais')
      .update({
        wpp_instance_id: dto.wpp_instance_id,
        wpp_token: dto.wpp_token,
      })
      .eq('id', id);

    if (error) {
      void this.auditoria.registrar({
        ator_id: actorProfissionalId ?? null,
        ator_tipo: 'admin',
        acao: 'credencial_zapi_atualizada',
        recurso: 'profissional',
        recurso_id: id,
        detalhes: { erro: error.message },
        resultado: 'falha',
      });
      throw new InternalServerErrorException(error.message);
    }

    void this.auditoria.registrar({
      ator_id: actorProfissionalId ?? null,
      ator_tipo: 'admin',
      acao: 'credencial_zapi_atualizada',
      recurso: 'profissional',
      recurso_id: id,
      detalhes: { wpp_instance_id: dto.wpp_instance_id },
      resultado: 'sucesso',
    });
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

  async criarProfissional(
    dto: CriarProfissionalDto,
    actorProfissionalId?: string | null,
  ): Promise<ProfissionalRow> {
    const { data: existenteSlug } = await this.supabase
      .from('profissionais')
      .select('id')
      .eq('slug', dto.slug)
      .maybeSingle();

    if (existenteSlug) {
      throw new ConflictException('Este slug já está em uso');
    }

    const { data: authUser, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.senhaTemporaria,
        email_confirm: true,
        user_metadata: {
          nome: dto.nome,
          slug: dto.slug,
          senha_temporaria: true,
        },
      });

    if (authError || !authUser?.user?.id) {
      void this.auditoria.registrar({
        ator_id: actorProfissionalId ?? null,
        ator_tipo: 'admin',
        acao: 'profissional_criado_admin',
        recurso: 'profissional',
        detalhes: { erro: authError?.message },
        resultado: 'falha',
      });
      throw new BadRequestException(
        this.mensagemErroAuthSupabase(authError?.message),
      );
    }

    const { data, error } = await this.supabase
      .from('profissionais')
      .insert({
        user_id: authUser.user.id,
        nome: dto.nome,
        slug: dto.slug,
        whatsapp: dto.whatsapp ?? '',
        plano: dto.plano ?? 'gratis',
        ativo: true,
        onboarding_concluido: true,
      })
      .select(SELECT_COLUNAS)
      .single<ProfissionalRow>();

    if (error || !data) {
      const msg = error?.message ?? 'desconhecido';
      void this.auditoria.registrar({
        ator_id: actorProfissionalId ?? null,
        ator_tipo: 'admin',
        acao: 'profissional_criado_admin',
        recurso: 'profissional',
        detalhes: { erro: msg },
        resultado: 'falha',
      });
      if (msg.includes('user_id')) {
        throw new BadRequestException(
          'O schema atual exige user_id. Não foi possível vincular o usuário criado no Auth ao profissional.',
        );
      }
      throw new InternalServerErrorException(
        `Erro ao criar profissional: ${msg}`,
      );
    }

    const criado = { ...data, email: authUser.user.email ?? dto.email };
    void this.auditoria.registrar({
      ator_id: actorProfissionalId ?? null,
      ator_tipo: 'admin',
      acao: 'profissional_criado_admin',
      recurso: 'profissional',
      recurso_id: criado.id,
      detalhes: {
        plano: criado.plano,
        senha_temporaria: true,
      },
      resultado: 'sucesso',
    });

    return criado;
  }

  async resetarSenha(
    id: string,
    actorProfissionalId?: string | null,
  ): Promise<{ ok: true; email: string }> {
    const prof = await this.buscarProfissional(id);
    const email = prof.email;

    if (!email) {
      void this.auditoria.registrar({
        ator_id: actorProfissionalId ?? null,
        ator_tipo: 'admin',
        acao: 'reset_senha_admin',
        recurso: 'profissional',
        recurso_id: id,
        detalhes: { erro: 'profissional_sem_email' },
        resultado: 'falha',
      });
      throw new BadRequestException('Profissional não possui e-mail vinculado.');
    }

    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: this.authRedirectUrl,
    });

    if (error) {
      void this.auditoria.registrar({
        ator_id: actorProfissionalId ?? null,
        ator_tipo: 'admin',
        acao: 'reset_senha_admin',
        recurso: 'profissional',
        recurso_id: id,
        detalhes: { erro: error.message },
        resultado: 'falha',
      });
      throw new BadRequestException(error.message);
    }

    void this.auditoria.registrar({
      ator_id: actorProfissionalId ?? null,
      ator_tipo: 'admin',
      acao: 'reset_senha_admin',
      recurso: 'profissional',
      recurso_id: id,
      resultado: 'sucesso',
    });

    return { ok: true, email };
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

  /**
   * Altera o plano de um profissional manualmente (admin).
   * Substitui o fluxo de pagamento enquanto o Stripe não está integrado.
   * Loga de/para para auditoria (sem dados sensíveis).
   */
  async alterarPlano(
    id: string,
    plano: PlanoId,
    actorUserId: string,
    actorProfissionalId?: string | null,
  ): Promise<{ ok: true; plano: PlanoId }> {
    const { data: atual, error: errAtual } = await this.supabase
      .from('profissionais')
      .select('id, plano')
      .eq('id', id)
      .single<{ id: string; plano: PlanoId }>();

    if (errAtual || !atual) {
      throw new NotFoundException('Profissional não encontrado');
    }

    if (atual.plano === plano) {
      return { ok: true, plano };
    }

    const { error } = await this.supabase
      .from('profissionais')
      .update({ plano })
      .eq('id', id);

    if (error) {
      void this.auditoria.registrar({
        ator_id: actorProfissionalId ?? null,
        ator_tipo: 'admin',
        acao: 'alteracao_plano',
        recurso: 'profissional',
        recurso_id: id,
        detalhes: { de: atual.plano, para: plano, erro: error.message },
        resultado: 'falha',
      });
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(
      `Plano alterado | profissional_id=${id} | de=${atual.plano} | para=${plano} | por=${actorUserId}`,
    );

    void this.auditoria.registrar({
      ator_id: actorProfissionalId ?? null,
      ator_tipo: 'admin',
      acao: 'alteracao_plano',
      recurso: 'profissional',
      recurso_id: id,
      detalhes: { de: atual.plano, para: plano },
      resultado: 'sucesso',
    });

    return { ok: true, plano };
  }
}

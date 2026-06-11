import {
  ConflictException,
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
import {
  PLAN_LIMITS,
  excedeuLimite,
  PLAN_LIMIT_REACHED_CODE,
} from '../../common/constants/plan.limits';
import { PlanoId } from '../planos/planos.catalog';

export interface Servico {
  id: string;
  profissional_id: string;
  nome: string;
  descricao: string | null;
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

  private normalizarNome(nome: string): string {
    return nome.trim().replace(/\s+/g, ' ');
  }

  private chaveNome(nome: string): string {
    return this.normalizarNome(nome).toLocaleLowerCase('pt-BR');
  }

  private async garantirNomeUnico(
    profissionalId: string,
    nome: string,
    ignorarId?: string,
  ): Promise<void> {
    const nomeNormalizado = this.chaveNome(nome);
    const { data, error } = await this.supabase
      .from('servicos')
      .select('id, nome')
      .eq('profissional_id', profissionalId);

    if (error) throw new InternalServerErrorException(error.message);

    const duplicado = (data ?? []).some((servico) => {
      if (ignorarId && servico.id === ignorarId) return false;
      return this.chaveNome(servico.nome) === nomeNormalizado;
    });

    if (duplicado) {
      throw new ConflictException({
        code: 'SERVICE_NAME_DUPLICATED',
        message: 'Já existe um serviço com este nome.',
      });
    }
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
    planoRaw?: string,
  ): Promise<Servico> {
    const profId = this.requireProf(profissionalId);
    const plano = (planoRaw as PlanoId) ?? 'gratis';
    const limiteServicos = PLAN_LIMITS[plano].servicos;

    if (limiteServicos !== null) {
      const { count, error: countError } = await this.supabase
        .from('servicos')
        .select('id', { count: 'exact', head: true })
        .eq('profissional_id', profId);
      if (countError) throw new InternalServerErrorException(countError.message);
      if (excedeuLimite(count ?? 0, limiteServicos)) {
        throw new ForbiddenException({
          code: PLAN_LIMIT_REACHED_CODE,
          resource: 'services',
          limit: limiteServicos,
          message: `Limite do plano atingido: ${limiteServicos} serviço${limiteServicos === 1 ? '' : 's'} permitido${limiteServicos === 1 ? '' : 's'} no plano atual.`,
        });
      }
    }

    const input = {
      ativo: true,
      ...dto,
      nome: this.normalizarNome(dto.nome),
      descricao: dto.descricao?.trim() || null,
    };
    await this.garantirNomeUnico(profId, input.nome);

    const { data, error } = await this.supabase
      .from('servicos')
      .insert({ ...input, profissional_id: profId })
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
    const input = {
      ...dto,
      ...(dto.nome ? { nome: this.normalizarNome(dto.nome) } : {}),
      ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
    };

    if (input.nome) {
      await this.garantirNomeUnico(profId, input.nome, id);
    }

    const { data, error } = await this.supabase
      .from('servicos')
      .update(input)
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
      .select('id, nome, descricao, duracao_min, preco, modalidade')
      .eq('profissional_id', profissionalId)
      .eq('ativo', true)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}

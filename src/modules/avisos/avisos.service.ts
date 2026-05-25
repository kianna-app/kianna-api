import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';
import { CriarAvisoDto } from './dto/criar-aviso.dto';
import { AtualizarAvisoDto } from './dto/atualizar-aviso.dto';

export interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  publicar_em: string;
  destino: 'todos' | 'selecionados';
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  excluida_em: string | null;
}

export interface AvisoComStats extends Aviso {
  estado: 'agendada' | 'publicada';
  destinatarios: string[];
  total_destinatarios: number;
  total_leituras: number;
}

export interface AvisoParaProfissional {
  id: string;
  titulo: string;
  corpo: string;
  publicar_em: string;
  lida_em: string | null;
}

export interface LeituraDetalhada {
  profissional_id: string;
  nome: string;
  lida_em: string | null;
}

@Injectable()
export class AvisosService {
  private readonly logger = new Logger(AvisosService.name);
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  // ─────────────────────────────────────────────────────────
  //  ADMIN
  // ─────────────────────────────────────────────────────────

  async criar(dto: CriarAvisoDto, criadoPor: string): Promise<Aviso> {
    if (
      dto.destino === 'selecionados' &&
      (!dto.destinatarios || dto.destinatarios.length === 0)
    ) {
      throw new BadRequestException(
        'Quando destino=selecionados é obrigatório informar destinatarios.',
      );
    }

    const payload = {
      titulo: dto.titulo,
      corpo: dto.corpo,
      publicar_em: dto.publicar_em ?? new Date().toISOString(),
      destino: dto.destino,
      criado_por: criadoPor,
    };

    const { data, error } = await this.supabase
      .from('avisos')
      .insert(payload)
      .select()
      .single<Aviso>();

    if (error || !data) {
      throw new InternalServerErrorException(
        `Erro ao criar aviso: ${error?.message ?? 'desconhecido'}`,
      );
    }

    if (dto.destino === 'selecionados' && dto.destinatarios?.length) {
      const rows = dto.destinatarios.map((pid) => ({
        aviso_id: data.id,
        profissional_id: pid,
      }));
      const { error: errDest } = await this.supabase
        .from('avisos_destinatarios')
        .insert(rows);
      if (errDest) {
        // rollback do aviso para não deixar órfão
        await this.supabase.from('avisos').delete().eq('id', data.id);
        throw new InternalServerErrorException(
          `Erro ao registrar destinatarios: ${errDest.message}`,
        );
      }
    }

    this.logger.log(
      `Aviso criado | id=${data.id} | criado_por=${criadoPor} | destino=${dto.destino} | publicar_em=${data.publicar_em}`,
    );
    return data;
  }

  async atualizar(id: string, dto: AtualizarAvisoDto): Promise<Aviso> {
    const existente = await this.porId(id);
    if (existente.excluida_em) {
      throw new BadRequestException('Aviso excluído não pode ser editado.');
    }

    const payload: Record<string, unknown> = {};
    if (dto.titulo !== undefined) payload.titulo = dto.titulo;
    if (dto.corpo !== undefined) payload.corpo = dto.corpo;
    if (dto.publicar_em !== undefined) payload.publicar_em = dto.publicar_em;
    if (dto.destino !== undefined) payload.destino = dto.destino;

    let atualizado = existente;
    if (Object.keys(payload).length > 0) {
      const { data, error } = await this.supabase
        .from('avisos')
        .update(payload)
        .eq('id', id)
        .select()
        .single<Aviso>();
      if (error || !data) {
        throw new InternalServerErrorException(
          `Erro ao atualizar aviso: ${error?.message ?? 'desconhecido'}`,
        );
      }
      atualizado = data;
    }

    if (dto.destinatarios !== undefined || dto.destino !== undefined) {
      const destinoFinal = atualizado.destino;
      // Limpa destinatários antigos
      await this.supabase
        .from('avisos_destinatarios')
        .delete()
        .eq('aviso_id', id);

      if (destinoFinal === 'selecionados') {
        if (!dto.destinatarios || dto.destinatarios.length === 0) {
          throw new BadRequestException(
            'destinatarios obrigatório quando destino=selecionados.',
          );
        }
        const rows = dto.destinatarios.map((pid) => ({
          aviso_id: id,
          profissional_id: pid,
        }));
        const { error: errDest } = await this.supabase
          .from('avisos_destinatarios')
          .insert(rows);
        if (errDest) {
          throw new InternalServerErrorException(
            `Erro ao atualizar destinatarios: ${errDest.message}`,
          );
        }
      }
    }

    this.logger.log(`Aviso atualizado | id=${id}`);
    return atualizado;
  }

  async excluir(id: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('avisos')
      .update({ excluida_em: new Date().toISOString() })
      .eq('id', id)
      .is('excluida_em', null)
      .select()
      .single<Aviso>();

    if (error || !data) {
      throw new NotFoundException('Aviso não encontrado ou já excluído.');
    }
    this.logger.log(`Aviso excluído (soft) | id=${id}`);
  }

  async listarHistorico(): Promise<AvisoComStats[]> {
    const { data: avisos, error } = await this.supabase
      .from('avisos')
      .select('*')
      .is('excluida_em', null)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Erro ao listar avisos: ${error.message}`,
      );
    }

    if (!avisos || avisos.length === 0) return [];

    const ids = (avisos as Aviso[]).map((a) => a.id);

    // Destinatários explícitos por aviso
    const { data: destLinks } = await this.supabase
      .from('avisos_destinatarios')
      .select('aviso_id, profissional_id')
      .in('aviso_id', ids);
    const destinatariosPorAviso = new Map<string, string[]>();
    for (const row of (destLinks ?? []) as {
      aviso_id: string;
      profissional_id: string;
    }[]) {
      const arr = destinatariosPorAviso.get(row.aviso_id) ?? [];
      arr.push(row.profissional_id);
      destinatariosPorAviso.set(row.aviso_id, arr);
    }

    // Total geral de profissionais ativos (para destino=todos)
    const { count: totalAtivos } = await this.supabase
      .from('profissionais')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true);

    // Leituras por aviso
    const { data: leituraLinks } = await this.supabase
      .from('avisos_leituras')
      .select('aviso_id')
      .in('aviso_id', ids);
    const leiturasPorAviso = new Map<string, number>();
    for (const row of (leituraLinks ?? []) as { aviso_id: string }[]) {
      leiturasPorAviso.set(
        row.aviso_id,
        (leiturasPorAviso.get(row.aviso_id) ?? 0) + 1,
      );
    }

    const agora = Date.now();
    return (avisos as Aviso[]).map((a) => {
      const destinatarios = destinatariosPorAviso.get(a.id) ?? [];
      const total_destinatarios =
        a.destino === 'todos' ? (totalAtivos ?? 0) : destinatarios.length;
      return {
        ...a,
        estado:
          new Date(a.publicar_em).getTime() <= agora ? 'publicada' : 'agendada',
        destinatarios,
        total_destinatarios,
        total_leituras: leiturasPorAviso.get(a.id) ?? 0,
      };
    });
  }

  async leiturasPorAviso(id: string): Promise<LeituraDetalhada[]> {
    const aviso = await this.porId(id);

    let profissionaisIds: string[] = [];
    if (aviso.destino === 'todos') {
      const { data, error } = await this.supabase
        .from('profissionais')
        .select('id')
        .eq('ativo', true);
      if (error) throw new InternalServerErrorException(error.message);
      profissionaisIds = (data ?? []).map((r) => r.id as string);
    } else {
      const { data, error } = await this.supabase
        .from('avisos_destinatarios')
        .select('profissional_id')
        .eq('aviso_id', id);
      if (error) throw new InternalServerErrorException(error.message);
      profissionaisIds = (data ?? []).map((r) => r.profissional_id as string);
    }

    if (profissionaisIds.length === 0) return [];

    const [{ data: profs }, { data: leituras }] = await Promise.all([
      this.supabase
        .from('profissionais')
        .select('id, nome')
        .in('id', profissionaisIds),
      this.supabase
        .from('avisos_leituras')
        .select('profissional_id, lida_em')
        .eq('aviso_id', id),
    ]);

    const lidoMap = new Map<string, string>();
    for (const r of (leituras ?? []) as {
      profissional_id: string;
      lida_em: string;
    }[]) {
      lidoMap.set(r.profissional_id, r.lida_em);
    }

    return ((profs ?? []) as { id: string; nome: string }[]).map((p) => ({
      profissional_id: p.id,
      nome: p.nome,
      lida_em: lidoMap.get(p.id) ?? null,
    }));
  }

  // ─────────────────────────────────────────────────────────
  //  PROFISSIONAL
  // ─────────────────────────────────────────────────────────

  async listarParaProfissional(
    profissionalId: string,
  ): Promise<AvisoParaProfissional[]> {
    const agora = new Date().toISOString();

    // Pega todos os avisos publicados (não excluídos, publicar_em <= agora)
    const { data: candidatos, error } = await this.supabase
      .from('avisos')
      .select('id, titulo, corpo, publicar_em, destino')
      .is('excluida_em', null)
      .lte('publicar_em', agora)
      .order('publicar_em', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    if (!candidatos || candidatos.length === 0) return [];

    // Avisos com destino=selecionados que incluem este profissional
    const idsCandidatos = (candidatos as Array<{ id: string }>).map(
      (c) => c.id,
    );
    const { data: destLinks } = await this.supabase
      .from('avisos_destinatarios')
      .select('aviso_id')
      .eq('profissional_id', profissionalId)
      .in('aviso_id', idsCandidatos);
    const selecionadosParaMim = new Set(
      ((destLinks ?? []) as Array<{ aviso_id: string }>).map((d) => d.aviso_id),
    );

    const aplicaveis = (candidatos as Array<Aviso>).filter(
      (a) => a.destino === 'todos' || selecionadosParaMim.has(a.id),
    );
    if (aplicaveis.length === 0) return [];

    const { data: minhasLeituras } = await this.supabase
      .from('avisos_leituras')
      .select('aviso_id, lida_em')
      .eq('profissional_id', profissionalId)
      .in(
        'aviso_id',
        aplicaveis.map((a) => a.id),
      );
    const lidoMap = new Map<string, string>();
    for (const r of (minhasLeituras ?? []) as {
      aviso_id: string;
      lida_em: string;
    }[]) {
      lidoMap.set(r.aviso_id, r.lida_em);
    }

    return aplicaveis.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      corpo: a.corpo,
      publicar_em: a.publicar_em,
      lida_em: lidoMap.get(a.id) ?? null,
    }));
  }

  async marcarComoLida(avisoId: string, profissionalId: string): Promise<void> {
    // Garante que o aviso é elegível para este profissional
    const aviso = await this.porId(avisoId);
    if (aviso.excluida_em) throw new NotFoundException('Aviso não encontrado.');
    if (new Date(aviso.publicar_em).getTime() > Date.now()) {
      throw new BadRequestException('Aviso ainda não publicado.');
    }

    if (aviso.destino === 'selecionados') {
      const { data: link } = await this.supabase
        .from('avisos_destinatarios')
        .select('aviso_id')
        .eq('aviso_id', avisoId)
        .eq('profissional_id', profissionalId)
        .maybeSingle();
      if (!link) throw new NotFoundException('Aviso não destinado a você.');
    }

    const { error } = await this.supabase.from('avisos_leituras').upsert(
      {
        aviso_id: avisoId,
        profissional_id: profissionalId,
        lida_em: new Date().toISOString(),
      },
      { onConflict: 'aviso_id,profissional_id' },
    );
    if (error) {
      throw new InternalServerErrorException(
        `Erro ao marcar leitura: ${error.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────

  private async porId(id: string): Promise<Aviso> {
    const { data, error } = await this.supabase
      .from('avisos')
      .select('*')
      .eq('id', id)
      .single<Aviso>();
    if (error || !data) {
      throw new NotFoundException('Aviso não encontrado.');
    }
    return data;
  }
}

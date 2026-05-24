import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../config/supabase.config';

export interface RelatorioPeriodo {
  inicio: string;
  fim: string;
}

export interface ContagemPorStatus {
  status: string;
  total: number;
}

export interface ContagemPorServico {
  servico_id: string | null;
  nome: string;
  total: number;
}

export interface RelatorioResponse {
  periodo: RelatorioPeriodo;
  total: number;
  por_status: ContagemPorStatus[];
  por_servico: ContagemPorServico[];
}

@Injectable()
export class RelatorioService {
  private readonly logger = new Logger(RelatorioService.name);
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createSupabaseClient(config);
  }

  async doMes(
    profissionalId: string,
    ano: number,
    mes: number,
  ): Promise<RelatorioResponse> {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 9999) {
      throw new BadRequestException('Ano inválido');
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('Mês inválido (use 1-12)');
    }

    const inicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0)).toISOString();
    const fim    = new Date(Date.UTC(ano, mes, 1, 0, 0, 0, 0)).toISOString();

    const { data, error } = await this.supabase.rpc('relatorio_agendamentos', {
      p_profissional_id: profissionalId,
      p_inicio: inicio,
      p_fim: fim,
    });

    if (error) {
      this.logger.error(`relatorio_agendamentos rpc falhou: ${error.message}`);
      throw new InternalServerErrorException('Erro ao gerar relatório');
    }

    return data as RelatorioResponse;
  }
}

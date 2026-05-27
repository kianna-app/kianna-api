import { PlanoId } from '../../modules/planos/planos.catalog';

export interface PlanoLimits {
  servicos: number | null;        // null = ilimitado
  agendamentosMes: number | null; // null = ilimitado
  whatsapp: boolean;
  relatorio: boolean;
  multiProfissional: number;
}

// Fonte única de verdade para limites por plano no backend.
// Mantida em sincronia com kianna-web/src/app/core/constants/plan.limits.ts.
// null representa ilimitado — nunca usar 999999 ou similar.
export const PLAN_LIMITS: Record<PlanoId, PlanoLimits> = {
  gratis: {
    servicos: 3,
    agendamentosMes: 30,
    whatsapp: false,
    relatorio: false,
    multiProfissional: 1,
  },
  essencial: {
    servicos: 15,
    agendamentosMes: 150,
    whatsapp: false,
    relatorio: false,
    multiProfissional: 1,
  },
  pro: {
    servicos: null,
    agendamentosMes: null,
    whatsapp: true,
    relatorio: false,
    multiProfissional: 1,
  },
  studio: {
    servicos: null,
    agendamentosMes: null,
    whatsapp: true,
    relatorio: true,
    multiProfissional: 5,
  },
};

export function isUnlimited(value: number | null): boolean {
  return value === null;
}

export function excedeuLimite(atual: number, limite: number | null): boolean {
  if (isUnlimited(limite)) return false;
  return atual >= (limite as number);
}

export const PLAN_LIMIT_REACHED_CODE = 'PLAN_LIMIT_REACHED';

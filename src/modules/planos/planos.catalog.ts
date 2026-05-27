/**
 * Catálogo de planos — fonte única no backend.
 *
 * Mantém-se em paralelo com kianna-web/src/app/core/data/planos.catalog.ts.
 * Esta cópia simplificada é o que `GET /api/planos` devolve; o front renderiza
 * a versão rica (chips, features detalhadas) a partir do seu próprio catálogo.
 *
 * TODO(pagamento): quando integrar Stripe, mapear cada plano para o stripe_price_id
 * correspondente e referenciar em iniciarUpgrade().
 */
export type PlanoId = 'gratis' | 'essencial' | 'pro' | 'studio';

export interface PlanoBackend {
  id: PlanoId;
  nome: string;
  preco: number;
  precoLabel: string;
  resumo: string;
}

export const PLANOS_BACKEND: PlanoBackend[] = [
  {
    id: 'gratis',
    nome: 'Grátis',
    preco: 0,
    precoLabel: 'R$ 0/mês',
    resumo: 'Agenda e página pública.',
  },
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 49,
    precoLabel: 'R$ 49/mês',
    resumo: 'Para profissionais que já passaram do Grátis.',
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 179,
    precoLabel: 'R$ 179/mês',
    resumo: 'Tudo + WhatsApp completo.',
  },
  {
    id: 'studio',
    nome: 'Studio',
    preco: 299,
    precoLabel: 'R$ 299/mês',
    resumo: 'Pro + múltiplos profissionais.',
  },
];

export const PLANO_IDS: PlanoId[] = ['gratis', 'essencial', 'pro', 'studio'];

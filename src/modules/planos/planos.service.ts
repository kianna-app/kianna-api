import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProfissionaisService } from '../profissionais/profissionais.service';
import { PLANOS_BACKEND, PlanoBackend, PlanoId } from './planos.catalog';

export interface CatalogoResponse {
  planos: PlanoBackend[];
  atual: PlanoId;
}

export interface UpgradeStubResponse {
  status: 'em_breve';
  mensagem: string;
  planoId: PlanoId;
}

@Injectable()
export class PlanosService {
  private readonly logger = new Logger(PlanosService.name);

  constructor(private readonly profissionais: ProfissionaisService) {}

  async catalogo(userId: string): Promise<CatalogoResponse> {
    const prof = await this.profissionais.porUserId(userId);
    return {
      planos: PLANOS_BACKEND,
      atual: (prof.plano as PlanoId) ?? 'gratis',
    };
  }

  /**
   * STUB de upgrade — registra a intenção do usuário e retorna "em breve".
   *
   * TODO(pagamento): integrar Stripe Checkout. Fluxo esperado:
   *   1. Validar planoId e que é um upgrade real (não downgrade aqui).
   *   2. Criar/recuperar customer no Stripe (stripe_customer_id em profissionais).
   *   3. Criar Checkout Session com o stripe_price_id correspondente ao planoId.
   *   4. Retornar { url } para o front redirecionar.
   *   5. Atualizar profissionais.plano via webhook `checkout.session.completed`.
   */
  async iniciarUpgrade(
    userId: string,
    planoId: PlanoId,
  ): Promise<UpgradeStubResponse> {
    const prof = await this.profissionais.porUserId(userId);
    if (!prof) throw new NotFoundException('Profissional não encontrado');

    this.logger.log(
      `Intenção de upgrade registrada | user_id=${userId} | de=${prof.plano} | para=${planoId}`,
    );

    return {
      status: 'em_breve',
      mensagem:
        'Pagamento online em breve. Sua intenção de upgrade foi registrada — em produção, ' +
        'aqui o usuário seria direcionado para a página de checkout.',
      planoId,
    };
  }
}

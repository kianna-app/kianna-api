import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfissionaisService } from '../profissionais/profissionais.service';
import { ServicosService } from '../servicos/servicos.service';
import { DisponibilidadesService } from '../disponibilidades/disponibilidades.service';
import { BloqueiosService } from '../bloqueios/bloqueios.service';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

const LIMITE_GRATIS_AGENDAMENTOS_MES = 20;

@Injectable()
export class BookingService {
  constructor(
    private readonly profService: ProfissionaisService,
    private readonly servicosService: ServicosService,
    private readonly dispService: DisponibilidadesService,
    private readonly bloqueiosService: BloqueiosService,
    private readonly agService: AgendamentosService,
  ) {}

  async dadosBookingPorSlug(slug: string) {
    const prof = await this.profService.porSlugInterno(slug);

    if (!prof) {
      const redirectSlug = await this.profService.buscarRedirectSlug(slug);
      if (redirectSlug) return { redirect_slug: redirectSlug };
      throw new NotFoundException('Profissional não encontrado');
    }

    const hoje = new Date().toISOString().split('T')[0];
    const janela = prof.antecedencia_maxima_dias ?? 30;
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + janela);
    const dataFimISO = dataFim.toISOString().split('T')[0];

    let lotado = false;
    if (prof.plano === 'gratis') {
      const count = await this.profService.contarAgendamentosNoMes(prof.id);
      lotado = count >= LIMITE_GRATIS_AGENDAMENTOS_MES;
    }

    const [servicos, disponibilidades, bloqueios, agendamentosConfirmados] =
      await Promise.all([
        this.servicosService.listarAtivos(prof.id),
        this.dispService.listarPorProfissional(prof.id),
        this.bloqueiosService.listarPorPeriodo(prof.id, hoje, dataFimISO),
        this.agService.listarConfirmadosPublico(prof.id, hoje, dataFimISO),
      ]);

    return {
      profissional: this.profService.filtrarCamposPublicos(prof),
      servicos,
      disponibilidades,
      bloqueios,
      agendamentos_confirmados: agendamentosConfirmados,
      lotado,
    };
  }
}

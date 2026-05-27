import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createSupabaseAnonClient,
  createSupabaseClient,
} from '../../config/supabase.config';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { PlanoId } from '../../modules/planos/planos.catalog';

interface ProfissionalRow {
  id: string;
  role: string | null;
  plano: string | null;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    if (!token) throw new UnauthorizedException('Token ausente');

    const supabase = createSupabaseAnonClient(this.config);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Token inválido');

    const admin = createSupabaseClient(this.config);
    const { data: prof } = await admin
      .from('profissionais')
      .select('id, role, plano')
      .eq('user_id', data.user.id)
      .single<ProfissionalRow>();

    req.user = {
      ...data.user,
      profissional_id: prof?.id,
      role: prof?.role ?? undefined,
      plano: (prof?.plano as PlanoId) ?? 'gratis',
    };
    return true;
  }
}

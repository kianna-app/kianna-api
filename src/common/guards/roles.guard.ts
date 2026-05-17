import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createSupabaseClient } from '../../config/supabase.config';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

interface RoleRow {
  role: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[] | undefined>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.id;
    if (!userId) return false;

    const supabase = createSupabaseClient(this.config);
    const { data } = await supabase
      .from('profissionais')
      .select('role')
      .eq('user_id', userId)
      .single<RoleRow>();

    return !!data?.role && roles.includes(data.role);
  }
}

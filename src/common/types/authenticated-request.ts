import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { PlanoId } from '../../modules/planos/planos.catalog';

export interface AuthUser extends User {
  profissional_id?: string;
  role?: string;
  plano?: PlanoId;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

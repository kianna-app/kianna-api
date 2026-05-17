import { Request } from 'express';
import { User } from '@supabase/supabase-js';

export interface AuthUser extends User {
  profissional_id?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

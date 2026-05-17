import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export const createSupabaseClient = (config: ConfigService) =>
  createClient(
    config.getOrThrow<string>('SUPABASE_URL'),
    config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

export const createSupabaseAnonClient = (config: ConfigService) =>
  createClient(
    config.getOrThrow<string>('SUPABASE_URL'),
    config.getOrThrow<string>('SUPABASE_ANON_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

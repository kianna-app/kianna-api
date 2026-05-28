import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ACOES_AUTH = [
  'login',
  'login_falha',
  'logout',
  'alteracao_senha',
  'exclusao_conta',
] as const;

export type AcaoAuth = (typeof ACOES_AUTH)[number];

export class RegistrarAuthEventoDto {
  @IsString()
  @IsIn(ACOES_AUTH as unknown as string[])
  acao!: AcaoAuth;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

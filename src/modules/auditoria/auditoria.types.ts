export type AuditoriaAtorTipo = 'profissional' | 'admin' | 'sistema';
export type AuditoriaResultado = 'sucesso' | 'falha';

export type AuditoriaAcao =
  | 'login'
  | 'login_falha'
  | 'logout'
  | 'alteracao_senha'
  | 'exclusao_conta'
  | 'profissional_criado_admin'
  | 'reset_senha_admin'
  | 'alteracao_plano'
  | 'credencial_zapi_atualizada'
  | 'notificacao_enviada'
  | 'notificacao_falha'
  | 'wpp_desconectado'
  | 'wpp_aviso_desconexao';

export type AuditoriaRecurso = 'sessao' | 'profissional' | 'whatsapp';

export interface AuditoriaEvento {
  ator_id?: string | null;
  ator_tipo: AuditoriaAtorTipo;
  acao: AuditoriaAcao;
  recurso: AuditoriaRecurso;
  recurso_id?: string | null;
  detalhes?: Record<string, unknown> | null;
  ip?: string | null;
  resultado: AuditoriaResultado;
}

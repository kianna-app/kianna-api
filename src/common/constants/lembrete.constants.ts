export const LEMBRETE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Desabilitado', value: null },
  { label: '1 hora antes', value: 1 },
  { label: '2 horas antes', value: 2 },
  { label: '4 horas antes', value: 4 },
  { label: '12 horas antes', value: 12 },
  { label: '24 horas antes', value: 24 },
];

export type WppStatus = 'desconectado' | 'conectando' | 'conectado' | 'erro';

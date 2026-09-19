import type { Company, Priority, Segment, Porte } from "./types";

const PESO_SEGMENTO: Record<Segment, number> = {
  bombeamento: 30,
  concreteira: 26,
  locadora: 18,
  construtora: 14,
  premoldados: 10,
};

const PESO_PORTE: Record<Porte, number> = {
  grande: 14,
  medio: 9,
  pequeno: 2,
};

export interface Pontuado {
  score: number;
  priority: Priority;
  breakdown: { label: string; points: number }[];
}

/**
 * Pontua a empresa de 0 a 100 conforme o encaixe com o equipamento da Arruda.
 * Regras explicitas e deterministicas: a mesma empresa sempre recebe a mesma nota.
 */
export function pontuar(empresa: Company): Pontuado {
  const breakdown: { label: string; points: number }[] = [];
  const somar = (label: string, points: number) => {
    if (points !== 0) breakdown.push({ label, points });
  };

  somar("Base", 10);
  somar(`Segmento: ${empresa.segment}`, PESO_SEGMENTO[empresa.segment] ?? 8);
  somar(`Porte: ${empresa.porte}`, PESO_PORTE[empresa.porte] ?? 0);

  if (empresa.bombeamento) somar("Trabalha com bombeamento", 16);
  if (empresa.frotaPropria) somar("Frota própria", 11);
  if (empresa.multiUnidades) somar("Mais de uma unidade", 8);

  if (empresa.whatsapp) somar("WhatsApp disponível", 5);
  else if (empresa.phone) somar("Telefone disponível", 3);
  if (empresa.website) somar("Site ativo", 3);

  const bruto = breakdown.reduce((soma, item) => soma + item.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(bruto)));

  return { score, priority: prioridade(score), breakdown };
}

export function prioridade(score: number): Priority {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

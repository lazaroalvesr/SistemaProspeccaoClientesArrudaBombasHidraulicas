import type { Porte, Segment, LeadStatus, Priority } from "./types";

export const UFS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export const SEGMENTOS: { valor: Segment; rotulo: string; busca: string }[] = [
  { valor: "concreteira", rotulo: "Concreteira", busca: "concreteira concreto usinado" },
  { valor: "bombeamento", rotulo: "Bombeamento de concreto", busca: "bombeamento de concreto" },
  { valor: "construtora", rotulo: "Construtora", busca: "construtora obras" },
  { valor: "locadora", rotulo: "Locadora de equipamentos", busca: "locação de equipamentos para construção" },
  { valor: "premoldados", rotulo: "Pré-moldados", busca: "pré-moldados de concreto" },
];

export const PORTES: { valor: Porte; rotulo: string }[] = [
  { valor: "pequeno", rotulo: "Pequeno" },
  { valor: "medio", rotulo: "Médio" },
  { valor: "grande", rotulo: "Grande" },
];

export const STATUS: { valor: LeadStatus; rotulo: string }[] = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "contatado", rotulo: "Contatado" },
  { valor: "negociando", rotulo: "Negociando" },
  { valor: "cliente", rotulo: "Cliente" },
  { valor: "descartado", rotulo: "Descartado" },
];

export const PRIORIDADE_DESC: Record<Priority, string> = {
  A: "Encaixe alto com o equipamento. Abordar primeiro.",
  B: "Bom encaixe. Vale contato na sequência.",
  C: "Encaixe parcial. Confirmar operação antes.",
  D: "Encaixe baixo. Só se sobrar tempo.",
};

export function rotuloSegmento(valor: string) {
  return SEGMENTOS.find((s) => s.valor === valor)?.rotulo ?? valor;
}

export function rotuloPorte(valor: string) {
  return PORTES.find((p) => p.valor === valor)?.rotulo ?? valor;
}

export function rotuloStatus(valor: string) {
  return STATUS.find((s) => s.valor === valor)?.rotulo ?? valor;
}

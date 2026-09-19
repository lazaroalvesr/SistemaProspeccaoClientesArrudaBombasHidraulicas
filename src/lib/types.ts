export type Segment =
  | "concreteira"
  | "bombeamento"
  | "construtora"
  | "locadora"
  | "premoldados";

export type Porte = "pequeno" | "medio" | "grande";

export type Priority = "A" | "B" | "C" | "D";

export type SearchSource = "google" | "cnpj-local" | "ambas";

export type LeadStatus =
  | "novo"
  | "contatado"
  | "negociando"
  | "cliente"
  | "descartado";

/** Dados oficiais trazidos da Receita Federal ao confirmar um lead por CNPJ. */
export interface DadosReceita {
  cnpj: string;
  matrizOuFilial: "matriz" | "filial";
  situacao: string;
  cnae: string | null;
  dataAbertura: string | null;
  capitalSocial: number | null;
  porteReceita: string | null;
  telefoneReceita: string | null;
}

/** Empresa encontrada pela busca, antes de virar lead salvo. */
export interface Company {
  externalId: string;
  name: string;
  city: string;
  uf: string;
  segment: Segment;
  porte: Porte;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  /** Texto curto sobre a estrutura da empresa (unidades, frota, porte). */
  structure: string | null;
  bombeamento: boolean;
  frotaPropria: boolean;
  multiUnidades: boolean;
  /** Fonte da empresa encontrada. */
  source: string;
  /** Sinais brutos usados na pontuacao, para auditoria. */
  signals: string[];
}

export interface ScoredCompany extends Company {
  score: number;
  priority: Priority;
  scoreBreakdown: { label: string; points: number }[];
  /** true se a empresa ja esta em Meus Leads. */
  alreadySaved: boolean;
  savedBy: string | null;
}

export interface SearchFilters {
  uf: string;
  city?: string;
  segment: Segment;
  portes: Porte[];
  termo?: string;
  fonte?: SearchSource;
}

export interface Lead {
  id: number;
  externalId: string | null;
  name: string;
  city: string;
  uf: string;
  segment: Segment;
  porte: Porte;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  structure: string | null;
  bombeamento: boolean;
  frotaPropria: boolean;
  multiUnidades: boolean;
  score: number;
  priority: Priority;
  status: LeadStatus;
  notes: string | null;
  source: string;
  ownerId: number;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  /** Preenchido quando alguém confirma o lead pela Receita Federal. */
  cnpj: string | null;
  cnpjConfirmado: boolean;
  matrizOuFilial: "matriz" | "filial" | null;
  cnae: string | null;
  dataAbertura: string | null;
  capitalSocial: number | null;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "vendedor";
}

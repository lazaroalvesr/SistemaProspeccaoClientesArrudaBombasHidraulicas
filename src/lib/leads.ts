import type { Lead } from "./types";

export interface LinhaLead {
  id: number;
  external_id: string | null;
  nome: string;
  cidade: string;
  uf: string;
  segmento: string;
  porte: string;
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  endereco: string | null;
  estrutura: string | null;
  bombeamento: number;
  frota_propria: number;
  multi_unidades: number;
  pontuacao: number;
  prioridade: string;
  status: string;
  observacoes: string | null;
  origem: string;
  usuario_id: number;
  dono: string;
  criado_em: string;
  atualizado_em: string;
  cnpj: string | null;
  matriz_filial: string | null;
  cnae: string | null;
  data_abertura: string | null;
  capital_social: number | null;
}

/** Converte a linha do SQLite no formato usado pela interface. */
export function paraLead(l: LinhaLead): Lead {
  return {
    id: l.id,
    externalId: l.external_id,
    name: l.nome,
    city: l.cidade,
    uf: l.uf,
    segment: l.segmento as Lead["segment"],
    porte: l.porte as Lead["porte"],
    phone: l.telefone,
    whatsapp: l.whatsapp,
    website: l.site,
    address: l.endereco,
    structure: l.estrutura,
    bombeamento: !!l.bombeamento,
    frotaPropria: !!l.frota_propria,
    multiUnidades: !!l.multi_unidades,
    score: l.pontuacao,
    priority: l.prioridade as Lead["priority"],
    status: l.status as Lead["status"],
    notes: l.observacoes,
    source: l.origem,
    ownerId: l.usuario_id,
    ownerName: l.dono,
    createdAt: l.criado_em,
    updatedAt: l.atualizado_em,
    cnpj: l.cnpj,
    cnpjConfirmado: !!l.cnpj,
    matrizOuFilial: (l.matriz_filial as Lead["matrizOuFilial"]) ?? null,
    cnae: l.cnae,
    dataAbertura: l.data_abertura,
    capitalSocial: l.capital_social,
  };
}

export const SELECT_LEADS = `
  SELECT l.*, u.nome AS dono
  FROM leads l JOIN usuarios u ON u.id = l.usuario_id
`;

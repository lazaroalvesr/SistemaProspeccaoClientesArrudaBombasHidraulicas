import type { Porte, Segment } from "./types";

/**
 * CNAEs (Classificação Nacional de Atividades Econômicas) usados para filtrar
 * a base da Receita Federal só nas empresas que interessam à Arruda.
 *
 * Fonte: tabela oficial do IBGE (grupo 23.3 — artefatos de concreto; divisão
 * 41-43 — construção; classe 7732-2 — aluguel de máquinas de construção).
 *
 * IMPORTANTE — limitação conhecida: "bombeamento de concreto" não tem CNAE
 * própria. Empresas de bombeamento em geral se registram como concreteira,
 * como locadora de equipamento com operador, ou dentro de "serviços
 * especializados para construção" (43991/99). Por isso, no provedor local,
 * bombeamento continua sendo inferido pelo nome da empresa — igual já era
 * feito no provedor do Google —, não pela CNAE.
 */
export const CNAE_POR_SEGMENTO: Record<Segment, string[]> = {
  concreteira: [
    "2330305", // Preparação de massa de concreto e argamassa para construção
  ],
  premoldados: [
    "2330301", // Estruturas pré-moldadas de concreto armado
    "2330304", // Casas pré-moldadas de concreto
    "2330399", // Outros artefatos e produtos de concreto/cimento
  ],
  locadora: [
    "7732201", // Aluguel de máquinas e equipamentos para construção sem operador
    "7732202", // Aluguel de máquinas e equipamentos para construção com operador
  ],
  construtora: [
    "4120400", // Construção de edifícios
    "4211101", // Construção de rodovias e ferrovias
    "4212000", // Obras de terraplenagem
    "4213800", // Obras de urbanização
    "4299501", // Construção de instalações esportivas e recreativas
    "4399101", // Administração de obras
    "4399102", // Montagem de estruturas metálicas
    "4399103", // Obras de fundações
    "4399104", // Serviços de operação de equipamentos de construção
    "4399105", // Perfuração de poços artesianos
    "4399199", // Serviços especializados para construção não especificados
  ],
  // bombeamento não tem CNAE própria — ver nota acima. Ao filtrar a base,
  // usamos os mesmos códigos de concreteira e locadora e distinguimos pelo
  // nome (contém "bomba", "bombeamento", "lança" etc.), assim como no Google.
  bombeamento: [],
};

/** Todas as CNAEs relevantes, para o filtro único na hora de ler o arquivo da Receita. */
export function todasAsCnaesRelevantes(): Set<string> {
  const s = new Set<string>();
  for (const lista of Object.values(CNAE_POR_SEGMENTO)) {
    for (const c of lista) s.add(c);
  }
  return s;
}

export function cnaeParaSegmento(cnae: string): Segment | null {
  for (const [segmento, lista] of Object.entries(CNAE_POR_SEGMENTO) as [
    Segment,
    string[],
  ][]) {
    if (lista.includes(cnae)) return segmento;
  }
  return null;
}

/**
 * Traduz o porte oficial da Receita para a escala pequeno/médio/grande usada
 * no sistema. "DEMAIS" é tudo que não é ME nem EPP — ou seja, empresas de
 * médio a grande porte; sem um segundo critério público, tratamos como
 * "grande" por ser o extremo mais provável de interesse comercial.
 *
 * Usada com o texto já traduzido que a BrasilAPI devolve (ex: "MICRO EMPRESA").
 */
export function traduzirPorteReceita(porteReceita: string | null): Porte | null {
  if (!porteReceita) return null;
  const p = porteReceita.toUpperCase();
  if (p.includes("MICRO")) return "pequeno";
  if (p.includes("PEQUENO")) return "medio";
  if (p.includes("DEMAIS")) return "grande";
  return null;
}

/**
 * Mesma tradução, mas a partir do CÓDIGO NUMÉRICO usado no CSV bruto da
 * Receita (arquivo Empresas*.csv, campo PORTE_EMPRESA): "00" não informado,
 * "01" microempresa, "03" empresa de pequeno porte, "05" demais.
 * Usada só pelo importador da base local (scripts/importar-cnpj.ts).
 */
export function traduzirPorteCodigoRfb(codigo: string | null): Porte | null {
  switch ((codigo ?? "").trim()) {
    case "01":
      return "pequeno";
    case "03":
      return "medio";
    case "05":
      return "grande";
    default:
      return null; // "00" ou vazio: não informado
  }
}

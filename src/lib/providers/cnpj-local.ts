import { db } from "../db";
import { normalizarTelefone, ehCelular } from "../whatsapp";
import { descreverEstrutura } from "../estrutura";
import type { Company, Porte, SearchFilters } from "../types";

interface LinhaRfb {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  matriz_filial: string;
  data_abertura: string | null;
  cnae_principal_desc: string | null;
  segmento: string;
  uf: string;
  municipio: string | null;
  logradouro: string | null;
  cep: string | null;
  ddd1: string | null;
  telefone1: string | null;
  porte: string | null;
  capital_social: number | null;
}

const PALAVRAS_BOMBEAMENTO = /bomb|lança|lanca/i;

/**
 * Busca na base local filtrada da Receita Federal (ver scripts/importar-cnpj.ts).
 * Não faz nenhuma chamada de rede — é uma consulta SQL direta, por isso é
 * instantânea e sem limite de uso. Só funciona depois que a importação
 * mensal rodou ao menos uma vez.
 */
export async function buscarCnpjLocal(filtros: SearchFilters): Promise<Company[]> {
  const condicoes = ["uf = ?"];
  const valores: unknown[] = [filtros.uf.toUpperCase()];

  if (filtros.segment !== "bombeamento") {
    condicoes.push("segmento = ?");
    valores.push(filtros.segment);
  } else {
    // sem CNAE própria: usamos concreteira/locadora como base e filtramos pelo nome abaixo
    condicoes.push("segmento IN ('concreteira', 'locadora')");
  }

  if (filtros.city) {
    condicoes.push("municipio LIKE ?");
    valores.push(`%${filtros.city}%`);
  }

  if (filtros.portes.length) {
    condicoes.push(`porte IN (${filtros.portes.map(() => "?").join(",")})`);
    valores.push(...filtros.portes);
  }

  const linhas = db
    .prepare(
      `SELECT cnpj, razao_social, nome_fantasia, matriz_filial, data_abertura,
              cnae_principal_desc, segmento, uf, municipio, logradouro, cep,
              ddd1, telefone1, porte, capital_social
       FROM empresas_rfb
       WHERE ${condicoes.join(" AND ")}
       ORDER BY capital_social DESC
       LIMIT 200`,
    )
    .all(...valores) as LinhaRfb[];

  const empresas: Company[] = [];

  for (const l of linhas) {
    const nome = l.razao_social || l.nome_fantasia || "—";
    const nomeMinusculo = nome.toLowerCase();

    if (filtros.segment === "bombeamento" && !PALAVRAS_BOMBEAMENTO.test(nomeMinusculo)) {
      continue; // sem CNAE própria: só entra se o nome indicar bombeamento
    }
    if (filtros.termo && !nomeMinusculo.includes(filtros.termo.toLowerCase())) {
      continue;
    }

    const telefone = normalizarTelefone(l.ddd1 && l.telefone1 ? `${l.ddd1}${l.telefone1}` : null);
    const porte = (l.porte as Porte) ?? "medio";
    const frotaPropria = porte !== "pequeno";
    const multiUnidades = l.matriz_filial === "filial"; // fato confirmado, não estimativa

    empresas.push({
      externalId: `rfb-${l.cnpj}`,
      name: nome,
      city: l.municipio ?? filtros.city ?? "—",
      uf: l.uf,
      segment: filtros.segment,
      porte,
      phone: telefone,
      whatsapp: ehCelular(telefone) ? telefone : null,
      website: null,
      address: [l.logradouro, l.cep].filter(Boolean).join(" — ") || null,
      structure: descreverEstrutura(porte, frotaPropria, multiUnidades),
      bombeamento:
        filtros.segment === "bombeamento" || PALAVRAS_BOMBEAMENTO.test(nomeMinusculo),
      frotaPropria,
      multiUnidades,
      source: "receita federal",
      signals: [
        `CNPJ confirmado: ${l.cnpj}`,
        l.matriz_filial === "filial" ? "Filial confirmada pela Receita" : "Matriz",
        l.data_abertura ? `aberta em ${l.data_abertura}` : null,
        l.cnae_principal_desc,
        l.capital_social ? `capital social R$ ${l.capital_social.toLocaleString("pt-BR")}` : null,
      ].filter(Boolean) as string[],
    });
  }

  return empresas;
}

/** Para a tela de admin: quando foi a última importação e quantas empresas ela trouxe. */
export function ultimaImportacaoRfb() {
  return db
    .prepare(
      `SELECT referencia, concluido_em, total_empresas, status, erro
       FROM importacoes_rfb ORDER BY id DESC LIMIT 1`,
    )
    .get() as
    | {
        referencia: string;
        concluido_em: string | null;
        total_empresas: number | null;
        status: string;
        erro: string | null;
      }
    | undefined;
}

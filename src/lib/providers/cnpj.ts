import { traduzirPorteReceita } from "../cnae";
import type { DadosReceita } from "../types";

export { traduzirPorteReceita };

/**
 * Confirma um CNPJ na base da Receita Federal via BrasilAPI (gratuita,
 * mantida pela comunidade, sem chave de API).
 *
 * IMPORTANTE: isto NÃO é uma busca. A Receita Federal não oferece, de forma
 * gratuita, "listar concreteiras em Jundiaí" — só resolve um CNPJ que você já
 * tem em mãos (do site da empresa, de uma nota fiscal, do Google). Por isso
 * esta função entra como uma etapa de CONFIRMAÇÃO de um lead já encontrado,
 * não como fonte da busca em si. Para busca por critério com dado de CNPJ,
 * veja src/lib/providers/cnpj-local.ts.
 */
export async function consultarCnpj(cnpjBruto: string): Promise<DadosReceita> {
  const cnpj = cnpjBruto.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    throw new Error("CNPJ precisa ter 14 dígitos.");
  }

  const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    cache: "no-store",
  });

  if (resposta.status === 404) {
    throw new Error("CNPJ não encontrado na Receita Federal.");
  }
  if (!resposta.ok) {
    throw new Error(`BrasilAPI respondeu ${resposta.status}. Tente novamente em instantes.`);
  }

  const d = await resposta.json();

  return {
    cnpj,
    matrizOuFilial: d.identificador_matriz_filial === 1 ? "matriz" : "filial",
    situacao: d.descricao_situacao_cadastral ?? "—",
    cnae: d.cnae_fiscal_descricao ?? null,
    dataAbertura: d.data_inicio_atividade ?? null,
    capitalSocial: typeof d.capital_social === "number" ? d.capital_social : null,
    porteReceita: d.porte ?? null,
    telefoneReceita: d.ddd_telefone_1 || null,
  };
}

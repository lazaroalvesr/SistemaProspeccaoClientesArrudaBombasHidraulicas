import { chaveDedupe } from "../db";
import { descreverEstrutura } from "../estrutura";
import type { Company, SearchFilters, SearchSource } from "../types";
import { buscarGoogle } from "./google";
import { buscarCnpjLocal } from "./cnpj-local";

const FONTES_VALIDAS: SearchSource[] = ["google", "cnpj-local", "ambas"];

export function fonteValida(valor: unknown): valor is SearchSource {
  return typeof valor === "string" && FONTES_VALIDAS.includes(valor as SearchSource);
}

/** Fonte inicial configurada no servidor, usada por clientes antigos sem seletor. */
export function provedorAtual(): SearchSource {
  const valor = process.env.SEARCH_PROVIDER?.toLowerCase();
  return fonteValida(valor) ? valor : "cnpj-local";
}

function combinarEmpresas(google: Company[], receita: Company[]): Company[] {
  const unicas = new Map<string, Company>();

  // A base da Receita entra primeiro para preservar CNPJ e porte oficial.
  for (const empresa of receita) {
    unicas.set(chaveDedupe(empresa.name, empresa.city, empresa.uf), empresa);
  }

  for (const empresa of google) {
    const chave = chaveDedupe(empresa.name, empresa.city, empresa.uf);
    const oficial = unicas.get(chave);
    if (!oficial) {
      unicas.set(chave, empresa);
      continue;
    }

    const bombeamento = oficial.bombeamento || empresa.bombeamento;
    const frotaPropria = oficial.frotaPropria || empresa.frotaPropria;
    const multiUnidades = oficial.multiUnidades || empresa.multiUnidades;
    unicas.set(chave, {
      ...oficial,
      phone: empresa.phone ?? oficial.phone,
      whatsapp: empresa.whatsapp ?? oficial.whatsapp,
      website: empresa.website ?? oficial.website,
      address: empresa.address ?? oficial.address,
      structure: descreverEstrutura(oficial.porte, frotaPropria, multiUnidades),
      bombeamento,
      frotaPropria,
      multiUnidades,
      source: "google + receita federal",
      signals: [...new Set([...oficial.signals, ...empresa.signals])],
    });
  }

  return [...unicas.values()];
}

export async function buscarEmpresas(filtros: SearchFilters): Promise<{
  empresas: Company[];
  fonte: SearchSource;
  avisos: string[];
}> {
  const fonte = filtros.fonte ?? provedorAtual();

  if (fonte === "google") {
    return { empresas: await buscarGoogle(filtros), fonte, avisos: [] };
  }
  if (fonte === "cnpj-local") {
    return { empresas: await buscarCnpjLocal(filtros), fonte, avisos: [] };
  }

  const [resultadoGoogle, resultadoReceita] = await Promise.allSettled([
    buscarGoogle(filtros),
    buscarCnpjLocal(filtros),
  ]);

  if (resultadoGoogle.status === "rejected" && resultadoReceita.status === "rejected") {
    throw new Error("Google e base CNPJ falharam. Tente uma fonte por vez.");
  }

  const avisos: string[] = [];
  if (resultadoGoogle.status === "rejected") {
    avisos.push("O Google não respondeu. Exibindo apenas resultados da base CNPJ.");
  }
  if (resultadoReceita.status === "rejected") {
    avisos.push("A base CNPJ não respondeu. Exibindo apenas resultados do Google.");
  }

  return {
    empresas: combinarEmpresas(
      resultadoGoogle.status === "fulfilled" ? resultadoGoogle.value : [],
      resultadoReceita.status === "fulfilled" ? resultadoReceita.value : [],
    ),
    fonte,
    avisos,
  };
}

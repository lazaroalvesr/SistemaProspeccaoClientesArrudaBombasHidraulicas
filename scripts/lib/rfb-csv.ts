/**
 * Parser de uma linha do CSV da Receita Federal: separado por ";", campos
 * entre aspas duplas, sem cabeçalho. Não uso uma lib de CSV genérica porque
 * o volume é grande (milhões de linhas) e um parser dedicado, sem regex, é
 * bem mais rápido — isso roda uma vez por mês, mas ainda assim processa
 * gigabytes de texto.
 */
export function parseLinhaRfb(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (c === ";" && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}

/** Converte "1.234,56" (formato numérico da Receita) para 1234.56. */
export function paraNumero(valor: string | undefined): number | null {
  if (!valor) return null;
  const limpo = valor.replace(/\./g, "").replace(",", ".").trim();
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** "20050314" -> "2005-03-14". Datas zeradas ou vazias viram null. */
export function paraData(valor: string | undefined): string | null {
  if (!valor || valor.length !== 8 || valor === "00000000") return null;
  return `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`;
}

export function paraTexto(valor: string | undefined): string | null {
  const t = valor?.trim();
  return t ? t : null;
}

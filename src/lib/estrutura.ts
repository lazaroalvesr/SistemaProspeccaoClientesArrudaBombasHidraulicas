import type { Porte } from "./types";

/** Frase curta sobre porte/frota/unidades, usada pelos cards de empresa. */
export function descreverEstrutura(porte: Porte, frota: boolean, unidades: boolean) {
  const partes: string[] = [];
  partes.push(
    porte === "grande"
      ? "Operação de grande porte"
      : porte === "medio"
        ? "Operação de médio porte"
        : "Operação de pequeno porte",
  );
  if (frota) partes.push("frota própria de caminhões");
  if (unidades) partes.push("mais de uma unidade");
  return partes.join(", ") + ".";
}

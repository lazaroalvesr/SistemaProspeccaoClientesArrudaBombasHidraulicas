import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Gera o hash no formato scrypt$<salt hex>$<hash hex>. */
export function gerarHash(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function conferirSenha(senha: string, armazenado: string): boolean {
  const partes = armazenado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const salt = Buffer.from(partes[1], "hex");
  const esperado = Buffer.from(partes[2], "hex");
  const calculado = scryptSync(senha.normalize("NFKC"), salt, esperado.length);
  return timingSafeEqual(esperado, calculado);
}

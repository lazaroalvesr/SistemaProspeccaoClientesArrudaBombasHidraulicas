import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { SessionUser } from "./types";

const COOKIE = "ab_sessao";
const DURACAO_HORAS = 12;

function segredo() {
  return process.env.SESSION_SECRET ?? "desenvolvimento-inseguro-troque-no-env";
}

function assinar(dados: string) {
  return createHmac("sha256", segredo()).update(dados).digest("hex");
}

export async function criarSessao(usuarioId: number) {
  const expira = Date.now() + DURACAO_HORAS * 60 * 60 * 1000;
  const dados = `${usuarioId}.${expira}`;
  const token = `${dados}.${assinar(dados)}`;

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_HORAS * 60 * 60,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Le o cookie, valida a assinatura e devolve o usuario ativo. */
export async function usuarioAtual(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const [id, expira, assinatura] = token.split(".");
  if (!id || !expira || !assinatura) return null;

  const esperada = Buffer.from(assinar(`${id}.${expira}`));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length) return null;
  if (!timingSafeEqual(esperada, recebida)) return null;
  if (Number(expira) < Date.now()) return null;

  const linha = db
    .prepare(
      "SELECT id, nome, email, papel FROM usuarios WHERE id = ? AND ativo = 1",
    )
    .get(Number(id)) as
    | { id: number; nome: string; email: string; papel: string }
    | undefined;

  if (!linha) return null;
  return {
    id: linha.id,
    name: linha.nome,
    email: linha.email,
    role: linha.papel === "admin" ? "admin" : "vendedor",
  };
}

/** Para rotas de API: devolve o usuario ou null (o handler decide a resposta). */
export async function exigirUsuario() {
  return usuarioAtual();
}

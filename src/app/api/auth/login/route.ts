import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conferirSenha } from "@/lib/senha";
import { criarSessao } from "@/lib/sessao";

export async function POST(req: Request) {
  const { email, senha } = (await req.json()) as {
    email?: string;
    senha?: string;
  };

  if (!email || !senha) {
    return NextResponse.json(
      { erro: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  const usuario = db
    .prepare("SELECT id, senha_hash, ativo FROM usuarios WHERE email = ?")
    .get(email.trim().toLowerCase()) as
    | { id: number; senha_hash: string; ativo: number }
    | undefined;

  // Mesma mensagem nos dois casos para nao revelar quais e-mails existem.
  if (!usuario || !usuario.ativo || !conferirSenha(senha, usuario.senha_hash)) {
    return NextResponse.json(
      { erro: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  await criarSessao(usuario.id);
  return NextResponse.json({ ok: true });
}

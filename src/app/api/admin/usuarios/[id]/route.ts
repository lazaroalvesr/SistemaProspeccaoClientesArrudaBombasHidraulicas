import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gerarHash } from "@/lib/senha";
import { exigirUsuario } from "@/lib/sessao";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  if (usuario.role !== "admin") {
    return NextResponse.json({ erro: "Acesso restrito ao administrador." }, { status: 403 });
  }

  const { id } = await params;
  const alvo = Number(id);
  const corpo = (await req.json()) as {
    ativo?: boolean;
    senha?: string;
    papel?: string;
    nome?: string;
  };

  const existente = db.prepare("SELECT id FROM usuarios WHERE id = ?").get(alvo);
  if (!existente) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });

  if (corpo.ativo === false && alvo === usuario.id) {
    return NextResponse.json(
      { erro: "Você não pode desativar o próprio acesso." },
      { status: 400 },
    );
  }

  if (corpo.nome?.trim()) {
    db.prepare("UPDATE usuarios SET nome = ? WHERE id = ?").run(corpo.nome.trim(), alvo);
  }
  if (corpo.ativo !== undefined) {
    db.prepare("UPDATE usuarios SET ativo = ? WHERE id = ?").run(corpo.ativo ? 1 : 0, alvo);
  }
  if (corpo.papel) {
    db.prepare("UPDATE usuarios SET papel = ? WHERE id = ?").run(
      corpo.papel === "admin" ? "admin" : "vendedor",
      alvo,
    );
  }
  if (corpo.senha) {
    if (corpo.senha.length < 8) {
      return NextResponse.json(
        { erro: "A senha precisa de pelo menos 8 caracteres." },
        { status: 400 },
      );
    }
    db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(
      gerarHash(corpo.senha),
      alvo,
    );
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gerarHash } from "@/lib/senha";
import { exigirUsuario } from "@/lib/sessao";

async function somenteAdmin() {
  const usuario = await exigirUsuario();
  if (!usuario) return { erro: NextResponse.json({ erro: "Sessão expirada." }, { status: 401 }) };
  if (usuario.role !== "admin") {
    return { erro: NextResponse.json({ erro: "Acesso restrito ao administrador." }, { status: 403 }) };
  }
  return { usuario };
}

export async function GET() {
  const { erro } = await somenteAdmin();
  if (erro) return erro;

  const usuarios = db
    .prepare(
      `SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.criado_em,
              (SELECT COUNT(*) FROM leads l WHERE l.usuario_id = u.id) AS leads
       FROM usuarios u ORDER BY u.nome`,
    )
    .all();

  return NextResponse.json({ usuarios });
}

export async function POST(req: Request) {
  const { erro } = await somenteAdmin();
  if (erro) return erro;

  const { nome, email, senha, papel } = (await req.json()) as {
    nome?: string;
    email?: string;
    senha?: string;
    papel?: string;
  };

  if (!nome?.trim() || !email?.trim() || !senha) {
    return NextResponse.json({ erro: "Preencha nome, e-mail e senha." }, { status: 400 });
  }
  if (senha.length < 8) {
    return NextResponse.json({ erro: "A senha precisa de pelo menos 8 caracteres." }, { status: 400 });
  }

  const jaExiste = db
    .prepare("SELECT id FROM usuarios WHERE email = ?")
    .get(email.trim().toLowerCase());
  if (jaExiste) {
    return NextResponse.json({ erro: "Já existe um usuário com esse e-mail." }, { status: 409 });
  }

  db.prepare(
    "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?,?,?,?)",
  ).run(
    nome.trim(),
    email.trim().toLowerCase(),
    gerarHash(senha),
    papel === "admin" ? "admin" : "vendedor",
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

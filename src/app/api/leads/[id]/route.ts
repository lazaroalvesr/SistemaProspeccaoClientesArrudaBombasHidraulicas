import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { STATUS } from "@/lib/catalogo";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const { id } = await params;
  const corpo = (await req.json()) as { status?: string; observacoes?: string };

  const lead = db.prepare("SELECT usuario_id FROM leads WHERE id = ?").get(Number(id)) as
    | { usuario_id: number }
    | undefined;
  if (!lead) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  if (corpo.status) {
    if (!STATUS.some((s) => s.valor === corpo.status)) {
      return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
    }
    db.prepare(
      "UPDATE leads SET status = ?, atualizado_em = datetime('now') WHERE id = ?",
    ).run(corpo.status, Number(id));
  }

  if (corpo.observacoes !== undefined) {
    db.prepare(
      "UPDATE leads SET observacoes = ?, atualizado_em = datetime('now') WHERE id = ?",
    ).run(corpo.observacoes.slice(0, 2000), Number(id));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const { id } = await params;
  const lead = db.prepare("SELECT usuario_id FROM leads WHERE id = ?").get(Number(id)) as
    | { usuario_id: number }
    | undefined;
  if (!lead) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  // Quem salvou pode remover; o administrador pode remover qualquer um.
  if (lead.usuario_id !== usuario.id && usuario.role !== "admin") {
    return NextResponse.json(
      { erro: "Só quem salvou o lead ou o administrador pode removê-lo." },
      { status: 403 },
    );
  }

  db.prepare("DELETE FROM leads WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}

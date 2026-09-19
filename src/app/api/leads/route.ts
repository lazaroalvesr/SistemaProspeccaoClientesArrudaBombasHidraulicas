import { NextResponse } from "next/server";
import { chaveDedupe, db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { SELECT_LEADS, paraLead, type LinhaLead } from "@/lib/leads";
import type { ScoredCompany } from "@/lib/types";

export async function GET(req: Request) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const prioridade = url.searchParams.get("prioridade");
  const meus = url.searchParams.get("meus") === "1";

  const condicoes: string[] = [];
  const valores: unknown[] = [];
  if (status) {
    condicoes.push("l.status = ?");
    valores.push(status);
  }
  if (prioridade) {
    condicoes.push("l.prioridade = ?");
    valores.push(prioridade);
  }
  if (meus) {
    condicoes.push("l.usuario_id = ?");
    valores.push(usuario.id);
  }

  const sql =
    SELECT_LEADS +
    (condicoes.length ? ` WHERE ${condicoes.join(" AND ")}` : "") +
    " ORDER BY l.pontuacao DESC, l.criado_em DESC";

  const linhas = db.prepare(sql).all(...valores) as LinhaLead[];
  return NextResponse.json({ leads: linhas.map(paraLead) });
}

export async function POST(req: Request) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const e = (await req.json()) as ScoredCompany;
  if (!e?.name || !e?.uf) {
    return NextResponse.json({ erro: "Dados da empresa incompletos." }, { status: 400 });
  }

  const chave = chaveDedupe(e.name, e.city ?? "", e.uf);
  const existente = db
    .prepare(
      `SELECT l.id, u.nome AS dono FROM leads l JOIN usuarios u ON u.id = l.usuario_id WHERE l.chave = ?`,
    )
    .get(chave) as { id: number; dono: string } | undefined;

  if (existente) {
    return NextResponse.json(
      { erro: `${e.name} já está em Meus Leads, salvo por ${existente.dono}.` },
      { status: 409 },
    );
  }

  const info = db
    .prepare(
      `INSERT INTO leads (
        chave, external_id, nome, cidade, uf, segmento, porte, telefone, whatsapp,
        site, endereco, estrutura, bombeamento, frota_propria, multi_unidades,
        pontuacao, prioridade, origem, usuario_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      chave,
      e.externalId ?? null,
      e.name,
      e.city ?? "—",
      e.uf,
      e.segment,
      e.porte,
      e.phone ?? null,
      e.whatsapp ?? null,
      e.website ?? null,
      e.address ?? null,
      e.structure ?? null,
      e.bombeamento ? 1 : 0,
      e.frotaPropria ? 1 : 0,
      e.multiUnidades ? 1 : 0,
      e.score ?? 0,
      e.priority ?? "D",
      e.source ?? "mock",
      usuario.id,
    );

  const criado = db
    .prepare(`${SELECT_LEADS} WHERE l.id = ?`)
    .get(info.lastInsertRowid) as LinhaLead;

  return NextResponse.json({ lead: paraLead(criado) }, { status: 201 });
}

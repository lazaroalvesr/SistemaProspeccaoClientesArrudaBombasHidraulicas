import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";

export async function GET() {
  if (!(await exigirUsuario())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const cidades = db.prepare(`
    SELECT DISTINCT municipio AS nome, uf
    FROM empresas_rfb
    WHERE municipio IS NOT NULL AND municipio <> ''
    ORDER BY municipio COLLATE NOCASE, uf
  `).all() as { nome: string; uf: string }[];

  return NextResponse.json({ cidades });
}

import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/sessao";
import cidades from "@/lib/cidades.json";

export async function GET() {
  if (!(await exigirUsuario())) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  return NextResponse.json({ cidades });
}

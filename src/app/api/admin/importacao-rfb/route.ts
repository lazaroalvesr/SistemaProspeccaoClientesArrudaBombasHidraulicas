import { NextResponse } from "next/server";
import { ultimaImportacaoRfb } from "@/lib/providers/cnpj-local";
import { exigirUsuario } from "@/lib/sessao";

export async function GET() {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  if (usuario.role !== "admin") {
    return NextResponse.json({ erro: "Acesso restrito ao administrador." }, { status: 403 });
  }

  return NextResponse.json({ ultima: ultimaImportacaoRfb() ?? null });
}

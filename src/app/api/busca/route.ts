import { NextResponse } from "next/server";
import { chaveDedupe, db } from "@/lib/db";
import { pontuar } from "@/lib/pontuacao";
import { buscarEmpresas, fonteValida, provedorAtual } from "@/lib/providers";
import { exigirUsuario } from "@/lib/sessao";
import type { Porte, ScoredCompany, SearchFilters, Segment } from "@/lib/types";

export async function POST(req: Request) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const corpo = (await req.json()) as Partial<SearchFilters>;
  if (!corpo.uf || !corpo.segment) {
    return NextResponse.json(
      { erro: "Escolha ao menos o estado e o segmento." },
      { status: 400 },
    );
  }
  if (corpo.fonte !== undefined && !fonteValida(corpo.fonte)) {
    return NextResponse.json(
      { erro: "Escolha Google, base CNPJ ou Ambas como fonte da busca." },
      { status: 400 },
    );
  }

  const filtros: SearchFilters = {
    uf: corpo.uf,
    city: corpo.city?.trim() || undefined,
    segment: corpo.segment as Segment,
    portes: (corpo.portes ?? []) as Porte[],
    termo: corpo.termo?.trim() || undefined,
    fonte: corpo.fonte ?? provedorAtual(),
  };

  let busca;
  try {
    busca = await buscarEmpresas(filtros);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha na busca.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }

  // Marca o que a equipe já salvou, para ninguém prospectar a mesma empresa duas vezes.
  const salvos = db
    .prepare(
      `SELECT l.chave, u.nome AS dono FROM leads l JOIN usuarios u ON u.id = l.usuario_id`,
    )
    .all() as { chave: string; dono: string }[];
  const mapa = new Map(salvos.map((s) => [s.chave, s.dono]));

  const resultado: ScoredCompany[] = busca.empresas
    .map((empresa) => {
      const { score, priority, breakdown } = pontuar(empresa);
      const chave = chaveDedupe(empresa.name, empresa.city, empresa.uf);
      return {
        ...empresa,
        score,
        priority,
        scoreBreakdown: breakdown,
        alreadySaved: mapa.has(chave),
        savedBy: mapa.get(chave) ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    provedor: busca.fonte,
    avisos: busca.avisos,
    total: resultado.length,
    empresas: resultado,
  });
}

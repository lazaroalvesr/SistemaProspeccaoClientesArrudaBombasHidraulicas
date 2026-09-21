import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SELECT_LEADS, paraLead, type LinhaLead } from "@/lib/leads";
import { pontuar } from "@/lib/pontuacao";
import { consultarCnpj, traduzirPorteReceita } from "@/lib/providers/cnpj";
import { exigirUsuario } from "@/lib/sessao";
import type { Company } from "@/lib/types";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Contexto) {
  const usuario = await exigirUsuario();
  if (!usuario) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const { id } = await params;
  const { cnpj } = (await req.json()) as { cnpj?: string };
  if (!cnpj) return NextResponse.json({ erro: "Informe o CNPJ." }, { status: 400 });

  const atual = db.prepare(`${SELECT_LEADS} WHERE l.id = ?`).get(Number(id)) as
    | LinhaLead
    | undefined;
  if (!atual) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });
  if (atual.usuario_id !== usuario.id && usuario.role !== "admin") {
    return NextResponse.json({ erro: "Esse lead pertence a outro vendedor." }, { status: 403 });
  }

  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) {
    return NextResponse.json({ erro: "CNPJ precisa ter 14 dígitos." }, { status: 400 });
  }

  let dados;
  try {
    dados = await consultarCnpj(digitos);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao consultar a Receita.";
    return NextResponse.json({ erro: mensagem }, { status: 502 });
  }

  const porteConfirmado = traduzirPorteReceita(dados.porteReceita);
  const empresaAtualizada: Company = {
    externalId: atual.external_id ?? `lead-${atual.id}`,
    name: atual.nome,
    city: atual.cidade,
    uf: atual.uf,
    segment: atual.segmento as Company["segment"],
    porte: porteConfirmado ?? (atual.porte as Company["porte"]),
    phone: atual.telefone || dados.telefoneReceita,
    whatsapp: atual.whatsapp,
    website: atual.site,
    address: atual.endereco,
    structure: atual.estrutura,
    bombeamento: !!atual.bombeamento,
    // filial confirmada pela Receita é prova concreta de mais de uma unidade.
    multiUnidades: dados.matrizOuFilial === "filial" ? true : !!atual.multi_unidades,
    frotaPropria: !!atual.frota_propria,
    source: atual.origem,
    signals: [],
  };

  const { score, priority } = pontuar(empresaAtualizada);

  db.prepare(
    `UPDATE leads SET
       porte = ?, multi_unidades = ?, telefone = COALESCE(telefone, ?),
       pontuacao = ?, prioridade = ?,
       cnpj = ?, matriz_filial = ?, cnae = ?, data_abertura = ?, capital_social = ?,
       atualizado_em = datetime('now')
     WHERE id = ?`,
  ).run(
    empresaAtualizada.porte,
    empresaAtualizada.multiUnidades ? 1 : 0,
    dados.telefoneReceita,
    score,
    priority,
    dados.cnpj,
    dados.matrizOuFilial,
    dados.cnae,
    dados.dataAbertura,
    dados.capitalSocial,
    Number(id),
  );

  const atualizado = db
    .prepare(`${SELECT_LEADS} WHERE l.id = ?`)
    .get(Number(id)) as LinhaLead;

  return NextResponse.json({ lead: paraLead(atualizado), situacaoReceita: dados.situacao });
}

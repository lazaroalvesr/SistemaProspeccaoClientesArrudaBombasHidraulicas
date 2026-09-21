import Link from "next/link";
import { db } from "@/lib/db";
import { usuarioAtual } from "@/lib/sessao";

type Status = "novo" | "contatado" | "negociando" | "cliente" | "descartado";

const ETAPAS: { status: Status; rotulo: string; classe: string }[] = [
  { status: "novo", rotulo: "Novos", classe: "novo" },
  { status: "contatado", rotulo: "Contatados", classe: "contatado" },
  { status: "negociando", rotulo: "Em negociação", classe: "negociando" },
  { status: "cliente", rotulo: "Clientes", classe: "cliente" },
];

type LinhaStatus = { status: Status; total: number };
type LeadRecente = {
  id: number;
  nome: string;
  cidade: string;
  uf: string;
  prioridade: string;
  pontuacao: number;
  status: Status;
  criado_em: string;
};

export default async function Dashboard() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  const somenteDoUsuario = usuario.role !== "admin";
  const ondeUsuario = somenteDoUsuario ? " WHERE usuario_id = ?" : "";
  const parametros = somenteDoUsuario ? [usuario.id] : [];

  const totais = db.prepare(
    `SELECT status, COUNT(*) AS total FROM leads${ondeUsuario} GROUP BY status`,
  ).all(...parametros) as LinhaStatus[];
  const porStatus = Object.fromEntries(totais.map((item) => [item.status, item.total])) as Record<Status, number>;
  const total = totais.reduce((soma, item) => soma + item.total, 0);
  const emAberto = (porStatus.novo ?? 0) + (porStatus.contatado ?? 0) + (porStatus.negociando ?? 0);
  const altaPrioridade = (db.prepare(
    `SELECT COUNT(*) AS total FROM leads WHERE prioridade = 'A' AND status NOT IN ('cliente', 'descartado')${somenteDoUsuario ? " AND usuario_id = ?" : ""}`,
  ).get(...parametros) as { total: number }).total;
  const recentes = db.prepare(
    `SELECT id, nome, cidade, uf, prioridade, pontuacao, status, criado_em FROM leads${ondeUsuario} ORDER BY criado_em DESC, id DESC LIMIT 6`,
  ).all(...parametros) as LeadRecente[];
  const maiorEtapa = Math.max(...ETAPAS.map((etapa) => porStatus[etapa.status] ?? 0), 1);

  return (
    <div className="dashboard">
      <div className="dashboard-topo">
        <div>
          <h1>Visão geral</h1>
          <p>{somenteDoUsuario ? "Acompanhe sua prospecção e encontre o próximo contato." : "Acompanhe a prospecção da equipe e encontre o próximo contato."}</p>
        </div>
        <Link className="link-botao btn-destaque" href="/buscar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Buscar empresas
        </Link>
      </div>

      <section className="resumo" aria-label="Resumo de leads">
        <div className="resumo-item">
          <span>Leads cadastrados</span>
          <strong className="numero">{total}</strong>
          <small>{somenteDoUsuario ? "Empresas na sua carteira" : "Empresas na carteira da equipe"}</small>
        </div>
        <div className="resumo-item">
          <span>Em andamento</span>
          <strong className="numero">{emAberto}</strong>
          <small>Novos, contatados e em negociação</small>
        </div>
        <div className="resumo-item">
          <span>Alta prioridade</span>
          <strong className="numero">{altaPrioridade}</strong>
          <small>Leads A ainda em aberto</small>
        </div>
        <div className="resumo-item">
          <span>Clientes</span>
          <strong className="numero">{porStatus.cliente ?? 0}</strong>
          <small>Marcados como cliente</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-painel">
          <div className="painel-cabecalho">
            <div>
              <h2>Funil comercial</h2>
              <p>Distribuição atual dos leads por etapa.</p>
            </div>
            <Link href="/leads">Ver todos os leads <span aria-hidden="true">→</span></Link>
          </div>
          <div className="funil">
            {ETAPAS.map((etapa) => {
              const quantidade = porStatus[etapa.status] ?? 0;
              return (
                <div className="funil-linha" key={etapa.status}>
                  <span className="funil-rotulo">{etapa.rotulo}</span>
                  <div className="funil-trilho" aria-label={`${etapa.rotulo}: ${quantidade}`}>
                    <div className={`funil-barra ${etapa.classe}`} style={{ width: quantidade ? `${Math.max((quantidade / maiorEtapa) * 100, 5)}%` : "0%" }} />
                  </div>
                  <strong className="numero">{quantidade}</strong>
                </div>
              );
            })}
          </div>
          {total === 0 && (
            <div className="dashboard-vazio">
              <strong>Sua carteira começa aqui.</strong>
              <p>Busque empresas e salve as que vale abordar. O andamento aparecerá nesta visão geral.</p>
              <Link href="/buscar">Encontrar empresas →</Link>
            </div>
          )}
        </section>

        <aside className="dashboard-lateral">
          <h2>Próximo passo</h2>
          <p>Encontre empresas que combinam com os equipamentos da Arruda e organize o contato em Meus leads.</p>
          <Link href="/buscar">Iniciar busca <span aria-hidden="true">→</span></Link>
          <div className="dashboard-lateral-divisor" />
          <span>COMO FUNCIONA</span>
          <ol>
            <li>Busque por região e segmento</li>
            <li>Compare a prioridade dos resultados</li>
            <li>Salve e acompanhe cada contato</li>
          </ol>
        </aside>
      </div>

      <section className="dashboard-painel recentes">
        <div className="painel-cabecalho">
          <div>
            <h2>Adicionados recentemente</h2>
            <p>{somenteDoUsuario ? "Últimas empresas salvas por você." : "Últimas empresas salvas pela equipe."}</p>
          </div>
          <Link href="/leads">Abrir carteira <span aria-hidden="true">→</span></Link>
        </div>
        {recentes.length ? (
          <div className="recentes-lista">
            {recentes.map((lead) => (
              <div className="recente" key={lead.id}>
                <span className={`recente-prioridade prioridade-${lead.prioridade}`}>{lead.prioridade}</span>
                <div className="recente-nome">
                  <strong>{lead.nome}</strong>
                  <span>{lead.cidade} · {lead.uf}</span>
                </div>
                <span className={`status status-${lead.status}`}>{ETAPAS.find((e) => e.status === lead.status)?.rotulo ?? "Descartado"}</span>
                <strong className="recente-pontos numero">{lead.pontuacao}<small>/100</small></strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="recentes-vazio">Nenhum lead salvo ainda. As empresas adicionadas aparecerão aqui.</div>
        )}
      </section>
    </div>
  );
}

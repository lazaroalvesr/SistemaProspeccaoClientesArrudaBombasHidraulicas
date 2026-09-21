"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS, rotuloPorte, rotuloSegmento } from "@/lib/catalogo";
import { formatarTelefone, linkWhatsapp } from "@/lib/whatsapp";
import type { Lead } from "@/lib/types";

export default function Leads() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");
  const [somenteMeus, setSomenteMeus] = useState(false);
  const [podeVerTodos, setPodeVerTodos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const parametros = new URLSearchParams();
    if (filtro !== "todos") parametros.set("status", filtro);
    if (somenteMeus) parametros.set("meus", "1");

    const resposta = await fetch(`/api/leads?${parametros}`);
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.erro ?? "Não foi possível carregar os leads.");
      return;
    }
    setErro(null);
    setLeads(dados.leads);
    setPodeVerTodos(!!dados.podeVerTodos);
  }, [filtro, somenteMeus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function confirmarPorCnpj(id: number, nome: string) {
    const cnpj = prompt(
      `CNPJ de ${nome} (14 dígitos, pode copiar com ou sem pontuação):`,
    );
    if (!cnpj) return;
    setErro(null);
    const resposta = await fetch(`/api/leads/${id}/enriquecer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.erro ?? "Não foi possível confirmar na Receita.");
      return;
    }
    carregar();
  }

  async function mudarStatus(id: number, status: string) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    carregar();
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover ${nome} de Meus leads?`)) return;
    const resposta = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!resposta.ok) {
      const dados = await resposta.json();
      setErro(dados.erro ?? "Não foi possível remover.");
      return;
    }
    carregar();
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Meus leads</h1>
        <p>
          {podeVerTodos
            ? "Acompanhe as empresas salvas pela equipe e seus responsáveis."
            : "Acompanhe somente as empresas que você salvou para prospectar."}
        </p>
      </div>

      <div className="abas">
        <button
          className={filtro === "todos" ? "ativo" : ""}
          onClick={() => setFiltro("todos")}
        >
          Todos
        </button>
        {STATUS.map((s) => (
          <button
            key={s.valor}
            className={filtro === s.valor ? "ativo" : ""}
            onClick={() => setFiltro(s.valor)}
          >
            {s.rotulo}
          </button>
        ))}
        {podeVerTodos && (
          <label className="marcador" style={{ marginLeft: "auto" }}>
            <input
              type="checkbox"
              checked={somenteMeus}
              onChange={(e) => setSomenteMeus(e.target.checked)}
            />
            Só os que eu salvei
          </label>
        )}
      </div>

      {erro && <div className="aviso">{erro}</div>}

      {leads?.length === 0 && (
        <div className="vazio">
          Nada salvo ainda. Vá em Buscar empresas, escolha a região e guarde
          aqui as que valem contato.
        </div>
      )}

      <div className="lista">
        {leads?.map((lead) => {
          const zap = linkWhatsapp(lead.whatsapp, lead.name);
          return (
            <article key={lead.id} className="empresa">
              <div className={`faixa faixa-${lead.priority}`}>
                <div className="placa">
                  <span>{lead.priority}</span>
                </div>
                <div className="medidor">
                  <i style={{ width: `${lead.score}%` }} />
                </div>
                <span className="nota numero">{lead.score}/100</span>
              </div>

              <div className="corpo">
                <h3>{lead.name}</h3>
                <p className="local">
                  {lead.city} — {lead.uf} · {rotuloSegmento(lead.segment)} · porte{" "}
                  {rotuloPorte(lead.porte)}
                </p>
                <div className="selos">
                  {lead.bombeamento && <span className="selo selo-sim">Bombeamento</span>}
                  {lead.frotaPropria && <span className="selo selo-sim">Frota própria</span>}
                  {lead.multiUnidades && <span className="selo selo-sim">Várias unidades</span>}
                  {lead.cnpjConfirmado && (
                    <span className="selo selo-sim">Porte confirmado — Receita</span>
                  )}
                </div>
                {lead.cnpjConfirmado && (
                  <p className="estrutura">
                    CNAE: {lead.cnae ?? "—"} · aberta em{" "}
                    {lead.dataAbertura ?? "—"} ·{" "}
                    {lead.matrizOuFilial === "filial" ? "filial" : "matriz"}
                    {lead.capitalSocial
                      ? ` · capital social R$ ${lead.capitalSocial.toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                )}
                <div className="contato">
                  <span className="numero">{formatarTelefone(lead.phone)}</span>
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer">
                      Site
                    </a>
                  )}
                  {podeVerTodos && <span>salvo por {lead.ownerName}</span>}
                </div>
              </div>

              <div className="acoes">
                {zap ? (
                  <a className="link-botao btn-zap" href={zap} target="_blank" rel="noreferrer">
                    Abrir WhatsApp
                  </a>
                ) : (
                  <button className="btn-neutro" disabled>
                    Sem WhatsApp
                  </button>
                )}

                <select
                  value={lead.status}
                  onChange={(e) => mudarStatus(lead.id, e.target.value)}
                  aria-label={`Situação de ${lead.name}`}
                >
                  {STATUS.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </option>
                  ))}
                </select>

                <button
                  className="btn-neutro btn-pequeno"
                  onClick={() => remover(lead.id, lead.name)}
                >
                  Remover
                </button>

                {!lead.cnpjConfirmado && (
                  <button
                    className="btn-neutro btn-pequeno"
                    onClick={() => confirmarPorCnpj(lead.id, lead.name)}
                  >
                    Confirmar pela Receita
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

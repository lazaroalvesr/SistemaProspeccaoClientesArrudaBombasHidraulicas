"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PORTES,
  SEGMENTOS,
  UFS,
  rotuloPorte,
  rotuloSegmento,
} from "@/lib/catalogo";
import { formatarTelefone, linkWhatsapp } from "@/lib/whatsapp";
import type { Porte, ScoredCompany, SearchSource, Segment } from "@/lib/types";

const POR_PAGINA = 12;
type Cidade = { nome: string; uf: string };

export default function Buscar() {
  const [uf, setUf] = useState("SP");
  const [cidade, setCidade] = useState("");
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [erroCidades, setErroCidades] = useState(false);
  const [segmento, setSegmento] = useState<Segment>("concreteira");
  const [portes, setPortes] = useState<Porte[]>(["medio", "grande"]);
  const [termo, setTermo] = useState("");
  const [fonte, setFonte] = useState<SearchSource>("cnpj-local");

  const [empresas, setEmpresas] = useState<ScoredCompany[] | null>(null);
  const [provedor, setProvedor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);

  // Paginação
  const [pagina, setPagina] = useState(1);

  const cidadesDoEstado = useMemo(
    () => cidades.filter((item) => item.uf === uf),
    [cidades, uf],
  );

  useEffect(() => {
    const controle = new AbortController();
    fetch("/api/cidades", { signal: controle.signal })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Falha ao carregar cidades");
        return resposta.json() as Promise<{ cidades: Cidade[] }>;
      })
      .then((dados) => setCidades(dados.cidades))
      .catch((erro) => {
        if (erro?.name !== "AbortError") setErroCidades(true);
      });
    return () => controle.abort();
  }, []);

  const totalPaginas = Math.ceil(
    (empresas?.length ?? 0) / POR_PAGINA,
  );

  const empresasPagina = useMemo(() => {
    if (!empresas) {
      return [];
    }

    const inicio = (pagina - 1) * POR_PAGINA;
    const fim = inicio + POR_PAGINA;

    return empresas.slice(inicio, fim);
  }, [empresas, pagina]);

  function alternarPorte(valor: Porte) {
    setPortes((atual) =>
      atual.includes(valor)
        ? atual.filter((p) => p !== valor)
        : [...atual, valor],
    );
  }

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault();

    setCarregando(true);
    setErro(null);
    setAvisos([]);
    setAberta(null);

    try {
      const resposta = await fetch("/api/busca", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uf,
          city: cidade ? cidade.slice(3) : "",
          segment: segmento,
          portes,
          termo,
          fonte,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "A busca falhou.");
        setEmpresas(null);
        setPagina(1);
        return;
      }

      setEmpresas(dados.empresas);
      setProvedor(dados.provedor);
      setAvisos(dados.avisos ?? []);

      // Toda nova busca começa na página 1
      setPagina(1);
    } catch {
      setErro(
        "Sem conexão com o servidor. Tente de novo.",
      );
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(empresa: ScoredCompany) {
    const resposta = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(empresa),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      setErro(
        dados.erro ??
          "Não foi possível salvar.",
      );
      return;
    }

    setEmpresas((atual) =>
      (atual ?? []).map((e) =>
        e.externalId === empresa.externalId
          ? {
              ...e,
              alreadySaved: true,
              savedBy: dados.lead.ownerName,
            }
          : e,
      ),
    );
  }

  function paginaAnterior() {
    setAberta(null);

    setPagina((atual) =>
      Math.max(1, atual - 1),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function proximaPagina() {
    setAberta(null);

    setPagina((atual) =>
      Math.min(
        totalPaginas,
        atual + 1,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function irParaPagina(numero: number) {
    setAberta(null);
    setPagina(numero);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Buscar empresas</h1>

        <p>
          Escolha a região e o tipo de empresa. A lista vem ordenada pela
          pontuação de encaixe com os equipamentos da Arruda.
        </p>
      </div>

      <form
        className="painel"
        onSubmit={buscar}
      >
        <fieldset className="fontes-busca">
          <legend>Fonte da busca</legend>
          <div className="fontes-opcoes">
            {([
              { valor: "cnpj-local", nome: "Base CNPJ", detalhe: "Dados da Receita no servidor" },
              { valor: "google", nome: "Google", detalhe: "Empresas do Google Places" },
              { valor: "ambas", nome: "Ambas", detalhe: "Resultados combinados" },
            ] as const).map((opcao) => (
              <label key={opcao.valor} className={`fonte-opcao ${fonte === opcao.valor ? "selecionada" : ""}`}>
                <input
                  type="radio"
                  name="fonte"
                  value={opcao.valor}
                  checked={fonte === opcao.valor}
                  onChange={() => setFonte(opcao.valor)}
                />
                <span><strong>{opcao.nome}</strong><small>{opcao.detalhe}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="campos">
          <div
            className="campo"
            style={{ maxWidth: 110 }}
          >
            <label htmlFor="uf">
              Estado
            </label>

            <select
              id="uf"
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                setCidade("");
              }}
            >
              {UFS.map((u) => (
                <option
                  key={u.sigla}
                  value={u.sigla}
                >
                  {u.sigla}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="cidade">
              Cidade (opcional)
            </label>

            <select
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            >
              <option value="">{erroCidades ? "Não foi possível carregar cidades" : cidades.length ? "Todas as cidades do estado" : "Carregando cidades…"}</option>
              {cidadesDoEstado.map((item) => (
                <option key={`${item.nome}-${item.uf}`} value={`${item.uf}:${item.nome}`}>
                  {item.nome} — {item.uf}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="segmento">
              Segmento
            </label>

            <select
              id="segmento"
              value={segmento}
              onChange={(e) =>
                setSegmento(
                  e.target.value as Segment,
                )
              }
            >
              {SEGMENTOS.map((s) => (
                <option
                  key={s.valor}
                  value={s.valor}
                >
                  {s.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="termo">
              Palavra extra (opcional)
            </label>

            <input
              id="termo"
              type="text"
              placeholder="usina, lança, 36 metros…"
              value={termo}
              onChange={(e) =>
                setTermo(e.target.value)
              }
            />
          </div>

          <button
            className="btn-destaque"
            disabled={carregando}
          >
            {carregando
              ? "Buscando…"
              : "Buscar empresas"}
          </button>
        </div>

        <div
          className="campo"
          style={{ marginTop: 14 }}
        >
          <label>Porte</label>

          <div className="marcadores">
            {PORTES.map((p) => (
              <label
                key={p.valor}
                className="marcador"
              >
                <input
                  type="checkbox"
                  checked={portes.includes(
                    p.valor,
                  )}
                  onChange={() =>
                    alternarPorte(p.valor)
                  }
                />

                {p.rotulo}
              </label>
            ))}
          </div>
        </div>
      </form>

      {!empresas && !carregando && !erro && (
        <div className="busca-inicial">
          <div className="busca-inicial-icone" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="21" cy="21" r="12" />
              <path d="m30 30 11 11M15 21h12M21 15v12" />
            </svg>
          </div>
          <h2>Encontre novas oportunidades</h2>
          <p>Defina os filtros acima e faça uma busca. As empresas aparecerão aqui, ordenadas pela prioridade de contato.</p>
        </div>
      )}

      {erro && (
        <div className="aviso">
          {erro}
        </div>
      )}

      {avisos.map((aviso) => (
        <div className="aviso aviso-neutro" key={aviso}>{aviso}</div>
      ))}

      {(provedor === "cnpj-local" || provedor === "ambas") &&
        empresas && (
          <div className="aviso aviso-neutro">
            {provedor === "ambas" ? "Busca combinada: Google Places e base local da Receita. " : "Fonte: base local da Receita Federal. "}
            Porte e matriz/filial vêm da Receita nos registros com CNPJ;
            bombeamento e frota própria podem ser estimados.
          </div>
        )}

      {empresas && (
        <p className="contagem">
          {empresas.length} empresas
          encontradas em {uf} ·{" "}
          {rotuloSegmento(segmento)}

          {totalPaginas > 1 && (
            <>
              {" "}
              · Página {pagina} de{" "}
              {totalPaginas}
            </>
          )}
        </p>
      )}

      {empresas?.length === 0 &&
        !erro && (
          <div className="vazio">
            Nenhuma empresa com esses
            filtros. Tente outro porte ou
            remova a cidade para abrir a
            busca para o estado inteiro.
          </div>
        )}

      <div className="lista">
        {empresasPagina.map(
          (empresa) => {
            const zap = linkWhatsapp(
              empresa.whatsapp,
              empresa.name,
            );

            const detalheAberto =
              aberta === empresa.externalId;

            return (
              <article
                key={empresa.externalId}
                className={`empresa ${
                  empresa.alreadySaved
                    ? "salva"
                    : ""
                }`}
              >
                <div
                  className={`faixa faixa-${empresa.priority}`}
                >
                  <div className="placa">
                    <span>
                      {empresa.priority}
                    </span>
                  </div>

                  <div className="medidor">
                    <i
                      style={{
                        width: `${empresa.score}%`,
                      }}
                    />
                  </div>

                  <span className="nota numero">
                    {empresa.score}/100
                  </span>
                </div>

                <div className="corpo">
                  <h3>
                    {empresa.name}
                  </h3>
                  <span className="origem-empresa">
                    {empresa.source === "google + receita federal"
                      ? "Google + Receita"
                      : empresa.source === "google"
                        ? "Google"
                        : "Base CNPJ"}
                  </span>

                  <p className="local">
                    {empresa.city} —{" "}
                    {empresa.uf} ·{" "}
                    {rotuloSegmento(
                      empresa.segment,
                    )}{" "}
                    · porte{" "}
                    {rotuloPorte(
                      empresa.porte,
                    )}
                  </p>

                  {empresa.structure && (
                    <p className="estrutura">
                      {
                        empresa.structure
                      }
                    </p>
                  )}

                  <div className="selos">
                    <span
                      className={
                        empresa.bombeamento
                          ? "selo selo-sim"
                          : "selo selo-nao"
                      }
                    >
                      Bombeamento:{" "}
                      {empresa.bombeamento
                        ? "sim"
                        : "não identificado"}
                    </span>

                    <span
                      className={
                        empresa.frotaPropria
                          ? "selo selo-sim"
                          : "selo selo-nao"
                      }
                    >
                      Frota própria:{" "}
                      {empresa.frotaPropria
                        ? "sim"
                        : "não identificado"}
                    </span>

                    <span
                      className={
                        empresa.multiUnidades
                          ? "selo selo-sim"
                          : "selo selo-nao"
                      }
                    >
                      Várias unidades:{" "}
                      {empresa.multiUnidades
                        ? "sim"
                        : "não identificado"}
                    </span>
                  </div>

                  <div className="contato">
                    <span className="numero">
                      {formatarTelefone(
                        empresa.phone,
                      )}
                    </span>

                    {empresa.website && (
                      <a
                        href={
                          empresa.website
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Site
                      </a>
                    )}

                    <button
                      type="button"
                      className="btn-neutro btn-pequeno"
                      onClick={() =>
                        setAberta(
                          detalheAberto
                            ? null
                            : empresa.externalId,
                        )
                      }
                    >
                      {detalheAberto
                        ? "Ocultar pontuação"
                        : "Ver pontuação"}
                    </button>
                  </div>
                </div>

                <div className="acoes">
                  {zap ? (
                    <a
                      className="link-botao btn-zap"
                      href={zap}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir WhatsApp
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn-neutro"
                      disabled
                    >
                      Sem WhatsApp
                    </button>
                  )}

                  {empresa.alreadySaved ? (
                    <>
                      <button
                        type="button"
                        className="btn-neutro"
                        disabled
                      >
                        Já está nos leads
                      </button>

                      {empresa.savedBy && (
                        <span className="dono">
                          salvo por{" "}
                          {
                            empresa.savedBy
                          }
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        salvar(empresa)
                      }
                    >
                      Salvar em Meus leads
                    </button>
                  )}
                </div>

                {detalheAberto && (
                  <div className="detalhe">
                    <ul>
                      {empresa.scoreBreakdown.map(
                        (item) => (
                          <li
                            key={
                              item.label
                            }
                          >
                            {item.label}:
                            +{item.points}
                          </li>
                        ),
                      )}

                      {empresa.signals.map(
                        (sinal) => (
                          <li key={sinal}>
                            {sinal}
                          </li>
                        ),
                      )}

                      {empresa.address && (
                        <li>
                          {
                            empresa.address
                          }
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </article>
            );
          },
        )}
      </div>

      {empresas &&
        empresas.length > 0 &&
        totalPaginas > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 28,
              marginBottom: 28,
            }}
          >
            <button
              type="button"
              className="btn-neutro"
              disabled={pagina === 1}
              onClick={paginaAnterior}
            >
              ← Anterior
            </button>

            {Array.from(
              {
                length:
                  totalPaginas,
              },
              (_, index) =>
                index + 1,
            ).map((numero) => (
              <button
                key={numero}
                type="button"
                className={
                  pagina === numero
                    ? "btn-destaque"
                    : "btn-neutro"
                }
                onClick={() =>
                  irParaPagina(
                    numero,
                  )
                }
                style={{
                  minWidth: 42,
                }}
              >
                {numero}
              </button>
            ))}

            <button
              type="button"
              className="btn-neutro"
              disabled={
                pagina === totalPaginas
              }
              onClick={proximaPagina}
            >
              Próxima →
            </button>
          </div>
        )}
    </>
  );
}

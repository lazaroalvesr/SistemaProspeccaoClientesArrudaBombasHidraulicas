"use client";

import { useEffect, useState } from "react";

interface UsuarioLinha {
  id: number;
  nome: string;
  email: string;
  papel: string;
  ativo: number;
  criado_em: string;
  leads: number;
}

export default function Admin() {
  const [usuarios, setUsuarios] = useState<UsuarioLinha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState("vendedor");

  const [importacao, setImportacao] = useState<{
    referencia: string;
    concluido_em: string | null;
    total_empresas: number | null;
    status: string;
    erro: string | null;
  } | null | undefined>(undefined);

  async function carregar() {
    const resposta = await fetch("/api/admin/usuarios");
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.erro ?? "Não foi possível carregar os usuários.");
      return;
    }
    setUsuarios(dados.usuarios);
  }

  async function carregarImportacao() {
    const resposta = await fetch("/api/admin/importacao-rfb");
    if (!resposta.ok) return;
    const dados = await resposta.json();
    setImportacao(dados.ultima);
  }

  useEffect(() => {
    carregar();
    carregarImportacao();
  }, []);

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setRecado(null);
    const resposta = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, papel }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.erro ?? "Não foi possível criar o acesso.");
      return;
    }
    setRecado(`Acesso criado para ${nome}. Passe a senha para a pessoa.`);
    setNome("");
    setEmail("");
    setSenha("");
    setPapel("vendedor");
    carregar();
  }

  async function alterar(id: number, mudanca: Record<string, unknown>) {
    setErro(null);
    setRecado(null);
    const resposta = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mudanca),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.erro ?? "Não foi possível alterar.");
      return;
    }
    carregar();
  }

  async function novaSenha(id: number, nomeUsuario: string) {
    const valor = prompt(`Nova senha para ${nomeUsuario} (mínimo 8 caracteres):`);
    if (!valor) return;
    await alterar(id, { senha: valor });
    setRecado(`Senha de ${nomeUsuario} trocada.`);
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Usuários</h1>
        <p>Quem entra na plataforma e o que cada um já salvou.</p>
      </div>

      {erro && <div className="aviso">{erro}</div>}
      {recado && <div className="aviso aviso-neutro">{recado}</div>}

      {importacao !== undefined && (
        <div className="painel" style={{ marginBottom: 22 }}>
          <h2 style={{ marginBottom: 10 }}>Base local da Receita (CNPJ)</h2>
          {importacao === null ? (
            <p style={{ color: "var(--cinza-texto)" }}>
              Nenhuma importação rodou ainda. Rode{" "}
              <code>npx tsx scripts/importar-cnpj.ts --mes=AAAA-MM</code> no
              servidor para habilitar a busca por CNPJ local.
            </p>
          ) : (
            <p style={{ color: "var(--cinza-texto)" }}>
              Referência <strong>{importacao.referencia}</strong> ·{" "}
              {importacao.status === "concluida"
                ? `${importacao.total_empresas?.toLocaleString("pt-BR")} empresas · concluída em ${importacao.concluido_em}`
                : importacao.status === "erro"
                  ? `falhou: ${importacao.erro}`
                  : "em andamento…"}
            </p>
          )}
        </div>
      )}

      <form className="painel" onSubmit={criar} style={{ marginBottom: 22 }}>
        <h2 style={{ marginBottom: 12 }}>Criar acesso</h2>
        <div className="campos">
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="email-novo">E-mail</label>
            <input
              id="email-novo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="senha-nova">Senha provisória</label>
            <input
              id="senha-nova"
              type="text"
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          <div className="campo" style={{ maxWidth: 160 }}>
            <label htmlFor="papel">Perfil</label>
            <select id="papel" value={papel} onChange={(e) => setPapel(e.target.value)}>
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button className="btn-destaque">Criar acesso</button>
        </div>
      </form>

      <div className="rolagem">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Leads</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios?.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.papel === "admin" ? "Administrador" : "Vendedor"}</td>
                <td className="numero">{u.leads}</td>
                <td>{u.ativo ? "Ativo" : "Desativado"}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-neutro btn-pequeno"
                    onClick={() => novaSenha(u.id, u.nome)}
                  >
                    Trocar senha
                  </button>
                  <button
                    className="btn-neutro btn-pequeno"
                    onClick={() => alterar(u.id, { ativo: !u.ativo })}
                  >
                    {u.ativo ? "Desativar" : "Reativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

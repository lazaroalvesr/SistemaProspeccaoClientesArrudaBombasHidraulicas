import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { gerarHash } from "./senha";

const arquivo = process.env.DATABASE_FILE ?? "./data/arruda.db";

function abrir(): Database.Database {
  const destino = path.resolve(process.cwd(), arquivo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });

  const conexao = new Database(destino);
  conexao.pragma("busy_timeout = 30000");
  conexao.pragma("journal_mode = WAL");
  conexao.pragma("foreign_keys = ON");

  conexao.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'vendedor',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave TEXT NOT NULL UNIQUE,
      external_id TEXT,
      nome TEXT NOT NULL,
      cidade TEXT NOT NULL,
      uf TEXT NOT NULL,
      segmento TEXT NOT NULL,
      porte TEXT NOT NULL,
      telefone TEXT,
      whatsapp TEXT,
      site TEXT,
      endereco TEXT,
      estrutura TEXT,
      bombeamento INTEGER NOT NULL DEFAULT 0,
      frota_propria INTEGER NOT NULL DEFAULT 0,
      multi_unidades INTEGER NOT NULL DEFAULT 0,
      pontuacao INTEGER NOT NULL DEFAULT 0,
      prioridade TEXT NOT NULL DEFAULT 'D',
      status TEXT NOT NULL DEFAULT 'novo',
      observacoes TEXT,
      origem TEXT NOT NULL DEFAULT 'mock',
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      cnpj TEXT,
      matriz_filial TEXT,
      cnae TEXT,
      data_abertura TEXT,
      capital_social REAL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_uf ON leads(uf);
    CREATE INDEX IF NOT EXISTS idx_leads_prioridade ON leads(prioridade);

    -- Base local filtrada da Receita Federal (dados abertos), atualizada
    -- mensalmente pelo script scripts/importar-cnpj.ts. Só guarda empresas
    -- cuja CNAE bate com os segmentos da Arruda — por isso é pequena, mesmo
    -- a base nacional completa tendo dezenas de milhões de registros.
    CREATE TABLE IF NOT EXISTS empresas_rfb (
      cnpj TEXT PRIMARY KEY,
      cnpj_basico TEXT NOT NULL,
      razao_social TEXT NOT NULL,
      nome_fantasia TEXT,
      matriz_filial TEXT NOT NULL,
      situacao TEXT NOT NULL,
      data_abertura TEXT,
      cnae_principal TEXT,
      cnae_principal_desc TEXT,
      segmento TEXT NOT NULL,
      uf TEXT NOT NULL,
      municipio TEXT,
      bairro TEXT,
      logradouro TEXT,
      cep TEXT,
      ddd1 TEXT,
      telefone1 TEXT,
      email TEXT,
      porte_receita TEXT,
      porte TEXT,
      capital_social REAL,
      importado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rfb_uf_segmento ON empresas_rfb(uf, segmento);
    CREATE INDEX IF NOT EXISTS idx_rfb_municipio ON empresas_rfb(municipio);

    -- Registra quando cada importação mensal rodou, para a tela de admin
    -- mostrar "última atualização" e para o cron evitar rodar em duplicidade.
    CREATE TABLE IF NOT EXISTS importacoes_rfb (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referencia TEXT NOT NULL,
      iniciado_em TEXT NOT NULL,
      concluido_em TEXT,
      total_empresas INTEGER,
      status TEXT NOT NULL DEFAULT 'em_andamento',
      erro TEXT
    );
  `);

  const colunasLead = conexao.prepare("PRAGMA table_info(leads)").all() as {
    name: string;
  }[];
  const nomes = new Set(colunasLead.map((c) => c.name));
  const novasColunas: [string, string][] = [
    ["cnpj", "TEXT"],
    ["matriz_filial", "TEXT"],
    ["cnae", "TEXT"],
    ["data_abertura", "TEXT"],
    ["capital_social", "REAL"],
  ];
  for (const [coluna, tipo] of novasColunas) {
    if (!nomes.has(coluna)) {
      conexao.exec(`ALTER TABLE leads ADD COLUMN ${coluna} ${tipo}`);
    }
  }

  const total = conexao
    .prepare("SELECT COUNT(*) AS n FROM usuarios")
    .get() as { n: number };

  if (total.n === 0) {
    conexao
      .prepare(
        "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')",
      )
      .run(
        process.env.ADMIN_NAME ?? "Administrador",
        (process.env.ADMIN_EMAIL ?? "admin@arrudabombas.com.br").toLowerCase(),
        gerarHash(process.env.ADMIN_PASSWORD ?? "arruda2026"),
      );
  }

  return conexao;
}

// Reaproveita a conexao entre recargas do Next em desenvolvimento.
const global_ = globalThis as unknown as { __arrudaDb?: Database.Database };
export const db: Database.Database = global_.__arrudaDb ?? abrir();
if (process.env.NODE_ENV !== "production") global_.__arrudaDb = db;

/** Chave usada para nao salvar a mesma empresa duas vezes. */
export function chaveDedupe(nome: string, cidade: string, uf: string) {
  const limpar = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(ltda|me|epp|sa|s\/a|eireli|comercio|industria)\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${limpar(nome)}|${limpar(cidade)}|${uf.toUpperCase()}`;
}

/**
 * Cria usuários a partir de uma linha JSON enviada pela entrada padrão.
 * Exemplo: [{ "nome": "...", "email": "...", "senha": "...", "papel": "vendedor" }]
 * Nenhuma senha é gravada no código ou exibida no terminal.
 */
import { createInterface } from "node:readline";
import path from "node:path";
import Database from "better-sqlite3";
import { gerarHash } from "../src/lib/senha";

interface UsuarioSeed {
  nome: string;
  email: string;
  senha: string;
  papel?: "admin" | "vendedor";
  substituirEmail?: string;
}

async function lerEntrada(): Promise<string> {
  const entrada = createInterface({ input: process.stdin, terminal: false });
  for await (const linha of entrada) {
    entrada.close();
    return linha;
  }
  throw new Error("Envie uma linha JSON com os usuários pela entrada padrão.");
}

async function main() {
  // Abre o banco sem executar a criação de tabelas do aplicativo. Isso permite
  // criar acessos enquanto a importação de CNPJ trabalha em outra conexão.
  const db = new Database(path.resolve(process.cwd(), process.env.DATABASE_FILE ?? "./data/arruda.db"));
  db.pragma("busy_timeout = 30000");
  const usuarios = JSON.parse(await lerEntrada()) as UsuarioSeed[];
  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    throw new Error("Informe uma lista não vazia de usuários.");
  }

  const normalizados = usuarios.map((usuario) => {
    const nome = usuario.nome?.trim();
    const email = usuario.email?.trim().toLowerCase();
    if (!nome || !email || !usuario.senha || usuario.senha.length < 8) {
      throw new Error("Cada usuário precisa de nome, e-mail e senha com pelo menos 8 caracteres.");
    }
    if (usuario.papel && !["admin", "vendedor"].includes(usuario.papel)) {
      throw new Error(`Perfil inválido para ${email}.`);
    }
    return {
      nome,
      email,
      senha: usuario.senha,
      papel: usuario.papel ?? "vendedor",
      substituirEmail: usuario.substituirEmail?.trim().toLowerCase(),
    };
  });

  const emails = normalizados.map((usuario) => usuario.email);
  if (new Set(emails).size !== emails.length) {
    throw new Error("Há e-mails repetidos na lista.");
  }

  const inserir = db.prepare(
    "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)",
  );
  const atualizar = db.prepare(
    "UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, papel = ?, ativo = 1 WHERE id = ?",
  );
  const existe = db.prepare("SELECT id, papel FROM usuarios WHERE email = ?");
  const resultado = db.transaction(() => normalizados.map((usuario) => {
    if (existe.get(usuario.email)) return { email: usuario.email, status: "já existia" };
    if (usuario.substituirEmail) {
      const anterior = existe.get(usuario.substituirEmail) as
        | { id: number; papel: string }
        | undefined;
      if (!anterior || anterior.papel !== "admin" || usuario.papel !== "admin") {
        throw new Error("A substituição exige um administrador existente e um novo perfil admin.");
      }
      atualizar.run(usuario.nome, usuario.email, gerarHash(usuario.senha), usuario.papel, anterior.id);
      return { email: usuario.email, status: "administrador atualizado" };
    }
    inserir.run(usuario.nome, usuario.email, gerarHash(usuario.senha), usuario.papel);
    return { email: usuario.email, status: "criado" };
  })).immediate();

  resultado.forEach((item) => console.log(`${item.email}: ${item.status}`));
  db.close();
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.stack : "Falha ao criar usuários.");
  process.exitCode = 1;
});

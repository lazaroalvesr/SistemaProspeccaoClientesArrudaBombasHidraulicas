#!/usr/bin/env -S npx tsx
/**
 * Importa a base de dados abertos de CNPJ da Receita Federal, filtrando só
 * as empresas cuja CNAE interessa à Arruda (ver src/lib/cnae.ts), e grava
 * numa tabela local (empresas_rfb) que a busca consulta sem chamar API
 * nenhuma.
 *
 * Uso:
 *   npx tsx scripts/importar-cnpj.ts --mes=2026-09
 *   npx tsx scripts/importar-cnpj.ts --mes=2026-09 --origem=/caminho/local   (para testar sem baixar)
 *   npx tsx scripts/importar-cnpj.ts --mes=2026-09 --manter-arquivos        (não apaga os .zip ao final)
 *
 * A Receita publica um snapshot completo por mês, sem diffs — por isso
 * "atualizar" é sempre reimportar do zero. Este script grava numa tabela de
 * preparo e só troca pela tabela em uso no final, com sucesso confirmado; se
 * der erro no meio, a base que a busca usa continua sendo a versão anterior.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { db } from "../src/lib/db";
import { CNAE_POR_SEGMENTO, traduzirPorteCodigoRfb } from "../src/lib/cnae";
import { parseLinhaRfb, paraData, paraNumero, paraTexto } from "./lib/rfb-csv";
import type { Segment } from "../src/lib/types";

// ---------- argumentos de linha de comando ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const mes = args.mes as string | undefined;
if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
  console.error("Uso: npx tsx scripts/importar-cnpj.ts --mes=AAAA-MM [--origem=...] [--manter-arquivos]");
  process.exit(1);
}

const origemBase = (args.origem as string) ?? `https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/${mes}`;
const ehRemoto = origemBase.startsWith("http");
const manterArquivos = args["manter-arquivos"] === "true";

const pastaTemp = path.resolve(process.cwd(), `.tmp-rfb-${mes}`);

// Estabelecimentos e Empresas vêm partidos em 10 arquivos cada (0 a 9).
// Socios, Simples, Naturezas, Países e Qualificações não são usados aqui.
const CNAES_RELEVANTES = new Set(Object.values(CNAE_POR_SEGMENTO).flat());

function cnaeParaSegmento(cnae: string): Segment | null {
  for (const [seg, lista] of Object.entries(CNAE_POR_SEGMENTO) as [Segment, string[]][]) {
    if (lista.includes(cnae)) return seg;
  }
  return null;
}

async function baixar(nomeArquivo: string): Promise<string> {
  const destino = path.join(pastaTemp, nomeArquivo);
  if (!ehRemoto) {
    const origemLocal = path.join(origemBase, nomeArquivo);
    if (!existsSync(origemLocal)) throw new Error(`NAO_ENCONTRADO:${nomeArquivo}`);
    return origemLocal;
  }

  const url = `${origemBase}/${nomeArquivo}`;
  let resposta: Response;
  try {
    resposta = await fetch(url);
  } catch (erro) {
    const causa = erro instanceof Error && erro.cause instanceof Error
      ? ` (${erro.cause.message})`
      : "";
    throw new Error(`Não foi possível conectar para baixar ${nomeArquivo} de ${url}${causa}`);
  }
  if (resposta.status === 404) {
    throw new Error(`NAO_ENCONTRADO:${nomeArquivo}`);
  }
  if (!resposta.ok || !resposta.body) {
    throw new Error(`Falha ao baixar ${nomeArquivo}: HTTP ${resposta.status}`);
  }

  await new Promise<void>((resolve, reject) => {
    const saida = createWriteStream(destino);
    const leitor = Readable.fromWeb(resposta.body as import("node:stream/web").ReadableStream);
    leitor.pipe(saida);
    saida.on("finish", resolve);
    saida.on("error", reject);
  });

  return destino;
}

/** Lê um .zip linha a linha, sem extrair pro disco. */
function lerZipLinhas(caminhoZip: string, aoReceberLinha: (linha: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // O Windows já inclui tar (bsdtar); em Linux usamos unzip.
    const noWindows = process.platform === "win32";
    const programa = noWindows ? "tar" : "unzip";
    const parametros = noWindows ? ["-xOf", caminhoZip] : ["-p", caminhoZip];
    const processo = spawn(programa, parametros);
    const rl = createInterface({ input: processo.stdout });
    rl.on("line", aoReceberLinha);

    let erro = "";
    processo.stderr.on("data", (d) => (erro += d.toString()));
    processo.on("error", reject);
    processo.on("close", (codigo) => {
      // unzip devolve 1 em alguns avisos não-fatais; tar exige código 0.
      if (codigo !== null && (noWindows ? codigo !== 0 : codigo >= 2)) {
        reject(new Error(`${programa} falhou (${codigo}) em ${caminhoZip}: ${erro}`));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  console.log(`Importação da Receita — referência ${mes}`);
  console.log(`Origem: ${origemBase} (${ehRemoto ? "remota" : "local"})`);

  mkdirSync(pastaTemp, { recursive: true });

  const registro = db
    .prepare(
      "INSERT INTO importacoes_rfb (referencia, iniciado_em, status) VALUES (?, datetime('now'), 'em_andamento')",
    )
    .run(mes);
  const idImportacao = registro.lastInsertRowid;

  try {
    // staging do zero a cada execução
    db.exec(`
      DROP TABLE IF EXISTS empresas_rfb_staging;
      CREATE TABLE empresas_rfb_staging (
        cnpj TEXT PRIMARY KEY,
        cnpj_basico TEXT NOT NULL,
        razao_social TEXT,
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
      DROP INDEX IF EXISTS idx_staging_cnpj_basico;
      CREATE INDEX idx_staging_cnpj_basico ON empresas_rfb_staging(cnpj_basico);
    `);

    // ---------- 1) CNAEs: código -> descrição ----------
    const descricaoCnae = new Map<string, string>();
    {
      const arquivo = await baixar("Cnaes.zip");
      await lerZipLinhas(arquivo, (linha) => {
        const [codigo, descricao] = parseLinhaRfb(linha);
        if (codigo) descricaoCnae.set(codigo.trim(), (descricao ?? "").trim());
      });
      console.log(`CNAEs carregadas: ${descricaoCnae.size}`);
    }

    // ---------- 2) Municípios: código -> nome ----------
    const nomeMunicipio = new Map<string, string>();
    {
      const arquivo = await baixar("Municipios.zip");
      await lerZipLinhas(arquivo, (linha) => {
        const [codigo, nome] = parseLinhaRfb(linha);
        if (codigo) nomeMunicipio.set(codigo.trim(), (nome ?? "").trim());
      });
      console.log(`Municípios carregados: ${nomeMunicipio.size}`);
    }

    // ---------- 3) Estabelecimentos: filtra pela CNAE e grava no staging ----------
    const inserirEstabelecimento = db.prepare(`
      INSERT OR IGNORE INTO empresas_rfb_staging
        (cnpj, cnpj_basico, nome_fantasia, matriz_filial, situacao, data_abertura,
         cnae_principal, cnae_principal_desc, segmento, uf, municipio, bairro,
         logradouro, cep, ddd1, telefone1, email, importado_em)
      VALUES (@cnpj, @cnpj_basico, @nome_fantasia, @matriz_filial, @situacao, @data_abertura,
              @cnae_principal, @cnae_principal_desc, @segmento, @uf, @municipio, @bairro,
              @logradouro, @cep, @ddd1, @telefone1, @email, datetime('now'))
    `);

    let totalLidas = 0;
    let totalFiltradas = 0;

    for (let i = 0; i < 10; i++) {
      const nomeArquivo = `Estabelecimentos${i}.zip`;
      let arquivo: string;
      try {
        arquivo = await baixar(nomeArquivo);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("NAO_ENCONTRADO")) {
          console.log(`${nomeArquivo} não existe neste mês — pulando.`);
          continue;
        }
        throw e;
      }

      const transacao = db.transaction((linhas: string[][]) => {
        for (const c of linhas) {
          const cnpjBasico = c[0];
          const cnpjOrdem = c[1];
          const cnpjDv = c[2];
          const matrizFilial = c[3] === "1" ? "matriz" : "filial";
          const situacaoCodigo = c[5];
          if (situacaoCodigo !== "02") continue; // só empresas ativas

          const cnaePrincipal = (c[11] ?? "").trim();
          const cnaeSecundarias = (c[12] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

          let cnaeUsada = "";
          let segmento: Segment | null = null;
          if (CNAES_RELEVANTES.has(cnaePrincipal)) {
            cnaeUsada = cnaePrincipal;
            segmento = cnaeParaSegmento(cnaePrincipal);
          } else {
            const secundariaRelevante = cnaeSecundarias.find((s) => CNAES_RELEVANTES.has(s));
            if (secundariaRelevante) {
              cnaeUsada = secundariaRelevante;
              segmento = cnaeParaSegmento(secundariaRelevante);
            }
          }
          if (!segmento) continue;

          inserirEstabelecimento.run({
            cnpj: `${cnpjBasico}${cnpjOrdem}${cnpjDv}`,
            cnpj_basico: cnpjBasico,
            nome_fantasia: paraTexto(c[4]),
            matriz_filial: matrizFilial,
            situacao: "ATIVA",
            data_abertura: paraData(c[10]),
            cnae_principal: cnaeUsada,
            cnae_principal_desc: descricaoCnae.get(cnaeUsada) ?? null,
            segmento,
            uf: (c[19] ?? "").trim(),
            municipio: nomeMunicipio.get((c[20] ?? "").trim()) ?? null,
            bairro: paraTexto(c[17]),
            logradouro: [paraTexto(c[13]), paraTexto(c[14]), paraTexto(c[15])]
              .filter(Boolean)
              .join(" "),
            cep: paraTexto(c[18]),
            ddd1: paraTexto(c[21]),
            telefone1: paraTexto(c[22]),
            email: paraTexto(c[27])?.toLowerCase() ?? null,
          });
          totalFiltradas++;
        }
      });

      let lote: string[][] = [];
      await lerZipLinhas(arquivo, (linha) => {
        totalLidas++;
        lote.push(parseLinhaRfb(linha));
        if (lote.length >= 5000) {
          transacao(lote);
          lote = [];
        }
      });
      if (lote.length) transacao(lote);

      if (ehRemoto && !manterArquivos) rmSync(arquivo, { force: true });
      console.log(`${nomeArquivo}: ${totalLidas} lidas até agora, ${totalFiltradas} relevantes.`);
    }

    console.log(`Estabelecimentos relevantes encontrados: ${totalFiltradas}`);

    // ---------- 4) Empresas: enriquece razão social, capital e porte ----------
    const existeCnpjBasico = db.prepare(
      "SELECT 1 FROM empresas_rfb_staging WHERE cnpj_basico = ? LIMIT 1",
    );
    const atualizarEmpresa = db.prepare(`
      UPDATE empresas_rfb_staging
      SET razao_social = @razao_social, capital_social = @capital_social,
          porte_receita = @porte_receita, porte = @porte
      WHERE cnpj_basico = @cnpj_basico
    `);

    let totalEnriquecidas = 0;
    for (let i = 0; i < 10; i++) {
      const nomeArquivo = `Empresas${i}.zip`;
      let arquivo: string;
      try {
        arquivo = await baixar(nomeArquivo);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("NAO_ENCONTRADO")) {
          console.log(`${nomeArquivo} não existe neste mês — pulando.`);
          continue;
        }
        throw e;
      }

      const transacao = db.transaction((linhas: string[][]) => {
        for (const c of linhas) {
          const cnpjBasico = c[0];
          if (!existeCnpjBasico.get(cnpjBasico)) continue; // não é uma empresa que filtramos
          const porteReceita = paraTexto(c[5]);
          atualizarEmpresa.run({
            cnpj_basico: cnpjBasico,
            razao_social: paraTexto(c[1]) ?? "—",
            capital_social: paraNumero(c[4]),
            porte_receita: porteReceita,
            porte: traduzirPorteCodigoRfb(porteReceita) ?? "medio",
          });
          totalEnriquecidas++;
        }
      });

      let lote: string[][] = [];
      await lerZipLinhas(arquivo, (linha) => {
        lote.push(parseLinhaRfb(linha));
        if (lote.length >= 5000) {
          transacao(lote);
          lote = [];
        }
      });
      if (lote.length) transacao(lote);

      if (ehRemoto && !manterArquivos) rmSync(arquivo, { force: true });
    }
    console.log(`Empresas enriquecidas com razão social/porte: ${totalEnriquecidas}`);

    // ---------- 5) troca atômica: staging vira a tabela em uso ----------
    const total = (
      db.prepare("SELECT COUNT(*) AS n FROM empresas_rfb_staging").get() as { n: number }
    ).n;

    db.exec(`
      BEGIN;
      DROP TABLE IF EXISTS empresas_rfb_antiga;
      ALTER TABLE empresas_rfb RENAME TO empresas_rfb_antiga;
      ALTER TABLE empresas_rfb_staging RENAME TO empresas_rfb;
      DROP TABLE empresas_rfb_antiga;
      DROP INDEX IF EXISTS idx_rfb_uf_segmento;
      DROP INDEX IF EXISTS idx_rfb_municipio;
      CREATE INDEX idx_rfb_uf_segmento ON empresas_rfb(uf, segmento);
      CREATE INDEX idx_rfb_municipio ON empresas_rfb(municipio);
      COMMIT;
    `);

    db.prepare(
      "UPDATE importacoes_rfb SET status = 'concluida', concluido_em = datetime('now'), total_empresas = ? WHERE id = ?",
    ).run(total, idImportacao);

    console.log(`Importação concluída: ${total} empresas na base local.`);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    db.prepare(
      "UPDATE importacoes_rfb SET status = 'erro', concluido_em = datetime('now'), erro = ? WHERE id = ?",
    ).run(mensagem, idImportacao);
    console.error("Importação falhou, base em uso não foi alterada:", mensagem);
    process.exitCode = 1;
  } finally {
    if (!manterArquivos) rmSync(pastaTemp, { recursive: true, force: true });
  }
}

main();

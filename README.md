# Prospecção — Arruda Bombas

Plataforma interna para encontrar e organizar possíveis clientes dos
equipamentos da Arruda Bombas: concreteiras, empresas de bombeamento,
construtoras, locadoras e pré-moldados.

## Como rodar

Precisa de Node.js 18.18 ou mais novo.

```bash
npm install
cp .env.example .env     # no Windows: copy .env.example .env
npm run dev
```

Abra `http://localhost:3000`.

Na primeira execução o sistema cria o banco `data/arruda.db` e o usuário
administrador definido no `.env`:

- e-mail: `admin@arrudabombas.com.br`
- senha: `arruda2026`

Troque essa senha antes de colocar no ar.

## Confirmar um lead pela Receita Federal

Depois de salvar um lead, dá pra confirmar os dados oficiais: abra **Meus leads**
e clique em **Confirmar pela Receita**, colando o CNPJ da empresa (geralmente
está no rodapé do site dela ou numa nota fiscal).

Isso consulta a BrasilAPI (gratuita, sem chave) e traz porte oficial, CNAE,
data de abertura, capital social e se é matriz ou filial — substituindo a
estimativa da busca por dado direto da Receita. Se vier "filial", o sistema já
marca "várias unidades" automaticamente, porque isso é fato, não suposição.

**Por que isso não entra na busca em si:** nenhuma base gratuita de CNPJ deixa
buscar por segmento e cidade — só resolve um CNPJ que você já tem em mãos. Uma
busca por filtro exigiria baixar a base completa da Receita para dentro do
servidor (gigabytes de dados) ou pagar por um serviço como CNPJá. Por isso a
confirmação por CNPJ é um passo manual, depois que a busca (Google ou base
local da Receita) já
trouxe a empresa.

## Buscar por CNPJ local (sem API, sem limite, sem custo)

Além de confirmar um lead por vez, dá pra importar a base filtrada da Receita
pro servidor e buscar direto nela — sem chamar nenhuma API em tempo de busca.

**Primeira importação (rode manualmente uma vez):**

```bash
npx tsx scripts/importar-cnpj.ts --mes=2026-09
```

O script baixa os arquivos automaticamente do repositório de dados abertos da
Receita em `https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/AAAA-MM/`.
Use um mês que já esteja publicado. No Windows, abra o PowerShell na pasta do
projeto e rode o mesmo comando; o importador usa o `tar` incluído no Windows
para ler os ZIPs. É preciso ter Node.js e npm instalados.

Isso baixa da Receita só os arquivos de Estabelecimentos, Empresas, Municípios
e CNAEs (pula Sócios, Simples e outros que não usamos), filtra em tempo real
só as empresas cuja CNAE bate com os segmentos da Arruda (concreteira,
pré-moldados, locadora, construção — ver `src/lib/cnae.ts`) e grava numa
tabela local. Como filtra durante a leitura, sem nunca gravar a base nacional
inteira em disco, o espaço permanente usado é pequeno (dezenas de MB) — só os
arquivos baixados durante a janela de importação (3-5 GB) ficam temporários e
são apagados ao final.

Depois da importação, selecione **Base CNPJ** na tela de busca. Para deixá-la
como fonte padrão, use no `.env`:

```
SEARCH_PROVIDER=cnpj-local
```

**Atualização mensal automática:** a Receita publica um snapshot completo por
mês (sem diffs — atualizar é sempre reimportar do zero). Os arquivos em
`deploy/cnpj-import.service` e `deploy/cnpj-import.timer` configuram isso via
systemd:

```bash
sudo cp deploy/cnpj-import.* /etc/systemd/system/
sudo mkdir -p /var/log/arruda
sudo chown www-data /var/log/arruda
sudo systemctl daemon-reload
sudo systemctl enable --now cnpj-import.timer
```

Isso roda todo dia 5 do mês, de madrugada. A importação escreve numa tabela
de preparo e só troca pela tabela em uso no final, com sucesso confirmado —
se a Receita mudar alguma coisa no meio do caminho e o script falhar, a busca
continua servindo os dados do mês anterior, sem ficar fora do ar. A tela
Admin mostra quando foi a última importação e se ela deu certo.

**Limitação importante:** bombeamento de concreto não tem CNAE própria — é
inferido pelo nome da empresa, igual no provedor do Google. Porte, CNAE e
"várias unidades" (matriz/filial), esses sim, vêm como fato direto da
Receita, sem estimativa nenhuma.

Se quiser testar a importação sem baixar nada da Receita (por exemplo, numa
máquina sem acesso a `dadosabertos.rfb.gov.br`), o script aceita
`--origem=/algum/caminho` com os `.zip` já baixados manualmente.

## Escolher a fonte na busca

Na tela **Buscar**, o vendedor escolhe **Base CNPJ**, **Google** ou **Ambas**
antes de pesquisar. **Ambas** consulta as duas fontes e reúne os resultados,
evitando duplicatas por nome e cidade. Nos registros encontrados nas duas,
os dados oficiais de CNPJ e porte vêm da Receita; telefone e site podem ser
complementados pelo Google. Se uma fonte falhar, a tela mostra o aviso e os
resultados da outra fonte.

`SEARCH_PROVIDER` define a fonte usada por chamadas à API que não enviam a
opção `fonte`. A tela de busca envia sempre a escolha do vendedor.

## Buscar empresas via Google

Para usar **Google** ou **Ambas**, configure no `.env`:

```
GOOGLE_PLACES_API_KEY=sua-chave
```

A chave sai do Google Cloud Console, com a **Places API (New)** ativada. A
busca usa o endpoint Text Search, que devolve nome, endereço, telefone e site
das empresas.

Três campos não existem em nenhuma base pública e são **estimados** pelo
sistema a partir do nome, do segmento e do volume de avaliações: bombeamento,
frota própria e várias unidades. A tela mostra "não identificado" quando não há
sinal, e o vendedor confirma no contato. O mesmo vale para o porte — diferente
do `cnpj-local`, onde porte e várias unidades vêm como fato direto da Receita.

### Outras fontes

Se no futuro quiser enriquecer com dados de CNPJ (CNAE, capital social, filiais,
data de abertura), dá para acrescentar um provedor novo em
`src/lib/providers/` — a busca é plugável. BrasilAPI e CNPJá têm endpoints
públicos de consulta por CNPJ.

## Como a pontuação funciona

Cada empresa recebe de 0 a 100 pontos, somando:

| Sinal | Pontos |
|---|---|
| Base | 10 |
| Segmento bombeamento / concreteira / locadora / construtora / pré-moldados | 30 / 26 / 18 / 14 / 10 |
| Porte grande / médio / pequeno | 14 / 9 / 2 |
| Trabalha com bombeamento | 16 |
| Frota própria | 11 |
| Mais de uma unidade | 8 |
| WhatsApp (ou só telefone) | 5 (ou 3) |
| Site ativo | 3 |

Prioridade: **A** a partir de 80, **B** a partir de 65, **C** a partir de 50,
**D** abaixo disso.

Os pesos ficam em `src/lib/pontuacao.ts`. Mude ali se a experiência da equipe
mostrar que algum sinal vale mais ou menos.

## Fluxo de uso

Entrar → escolher estado, cidade, segmento e porte → buscar → conferir a lista
ordenada por pontuação → salvar os melhores em Meus leads → abrir o WhatsApp →
fazer a abordagem.

O sistema **não envia mensagem nenhuma sozinho**. O botão só abre a conversa
com um texto já digitado; quem envia é o vendedor.

## Leads sem repetição

Ao salvar, o sistema monta uma chave com nome + cidade + estado (ignorando
Ltda, ME, acentos e pontuação). Se a empresa já estiver salva, a busca mostra
"já está nos leads" e diz quem salvou.

## Estrutura

```
src/
  app/
    login/                tela de entrada
    (app)/buscar/         busca de empresas
    (app)/leads/          Meus leads
    (app)/admin/          usuários
    api/                  rotas de dados
  lib/
    db.ts                 SQLite + schema
    sessao.ts             cookie de sessão assinado
    senha.ts              hash scrypt
    pontuacao.ts          regras de pontuação
    whatsapp.ts           telefone e link wa.me
    providers/            fontes de busca (google, cnpj-local)
```

## Colocar no ar

O banco é um arquivo SQLite, então o servidor precisa de disco gravável —
uma VPS, um container com volume, ou um serviço como Railway ou Render. Vercel
não serve nesse formato porque o disco é efêmero; nesse caso troque o SQLite
por Postgres (o acesso ao banco está concentrado em `src/lib/db.ts` e nas rotas
de API).

Antes de publicar:

1. Gere um `SESSION_SECRET` aleatório longo.
2. Troque a senha do administrador.
3. Rode atrás de HTTPS — o cookie de sessão já vira `secure` em produção.

## Sobre o visual

A interface segue uma linguagem industrial — ficha técnica de equipamento e
sinalização de obra — em vez do visual genérico de painel SaaS. Prioridade
aparece como placa em losango (sinalização), a pontuação como medidor de
pressão, e os cards têm cantos retos e sombra "chapa parafusada" em vez de
sombra suave arredondada. As fontes são Barlow Condensed (títulos/placas) e
IBM Plex Sans (corpo), carregadas do Google Fonts.

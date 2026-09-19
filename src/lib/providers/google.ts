import { SEGMENTOS } from "../catalogo";
import { normalizarTelefone, ehCelular } from "../whatsapp";
import { descreverEstrutura } from "../estrutura";
import type { Company, Porte, SearchFilters } from "../types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const CAMPOS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

interface LugarGoogle {
  id: string;

  displayName?: {
    text?: string;
  };

  formattedAddress?: string;

  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];

  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

interface PlacesResposta {
  places?: LugarGoogle[];
  nextPageToken?: string;
}

export async function buscarGoogle(
  filtros: SearchFilters,
): Promise<Company[]> {
  const chave = process.env.GOOGLE_PLACES_API_KEY;

  if (!chave) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY não configurada. Defina a chave no .env.",
    );
  }

  const termoSegmento =
    SEGMENTOS.find(
      (segmento) => segmento.valor === filtros.segment,
    )?.busca ?? filtros.segment;

  const local = filtros.city
    ? `${filtros.city}, ${filtros.uf}`
    : filtros.uf;

  const textQuery = [
    termoSegmento,
    filtros.termo,
    "em",
    local,
  ]
    .filter(Boolean)
    .join(" ");

  console.log("======================================");
  console.log("GOOGLE PLACES");
  console.log("Query:", textQuery);
  console.log("======================================");

  const lugares = await buscarTodasPaginas(
    textQuery,
    chave,
  );

  console.log(
    "Total recebido do Google:",
    lugares.length,
  );

  // Remove duplicados pelo ID do Google Places
  const unicos = Array.from(
    new Map(
      lugares.map((lugar) => [
        lugar.id,
        lugar,
      ]),
    ).values(),
  );

  console.log(
    "Depois de remover duplicados:",
    unicos.length,
  );

  const lugaresAbertos = unicos.filter(
    (lugar) =>
      lugar.businessStatus !==
      "CLOSED_PERMANENTLY",
  );

  console.log(
    "Depois de remover fechados:",
    lugaresAbertos.length,
  );

  const empresas: Company[] =
    lugaresAbertos.map((lugar) => {
      const nome =
        lugar.displayName?.text?.trim() ||
        "Sem nome";

      const componentes =
        lugar.addressComponents ?? [];

      const cidade =
        componentes.find((componente) =>
          (
            componente.types ?? []
          ).includes(
            "administrative_area_level_2",
          ),
        )?.longText ??
        componentes.find((componente) =>
          (
            componente.types ?? []
          ).includes("locality"),
        )?.longText ??
        componentes.find((componente) =>
          (
            componente.types ?? []
          ).includes(
            "administrative_area_level_3",
          ),
        )?.longText ??
        filtros.city ??
        "—";

      const uf =
        componentes.find((componente) =>
          (
            componente.types ?? []
          ).includes(
            "administrative_area_level_1",
          ),
        )?.shortText ??
        filtros.uf;

      const telefone =
        normalizarTelefone(
          lugar.internationalPhoneNumber ??
            lugar.nationalPhoneNumber ??
            null,
        );

      const avaliacoes =
        lugar.userRatingCount ?? 0;

      const temSite =
        Boolean(lugar.websiteUri);

      const porte = estimarPorte(
        avaliacoes,
        temSite,
      );

      const nomeMinusculo =
        nome.toLowerCase();

      const bombeamento =
        filtros.segment ===
          "bombeamento" ||
        /bomba|bombeament|lança|lanca/.test(
          nomeMinusculo,
        ) ||
        (filtros.segment ===
          "concreteira" &&
          porte !== "pequeno");

      const frotaPropria =
        filtros.segment !==
          "construtora" &&
        porte !== "pequeno";

      const multiUnidades =
        avaliacoes >= 120 ||
        /grupo|filial|unidade/.test(
          nomeMinusculo,
        );

      const sinais = [
        `${avaliacoes} avaliações no Google`,

        typeof lugar.rating === "number"
          ? `nota ${lugar.rating.toFixed(1)}`
          : null,

        lugar.websiteUri
          ? "site publicado"
          : "sem site",
      ].filter(
        (item): item is string =>
          Boolean(item),
      );

      const empresa: Company = {
        externalId: lugar.id,
        name: nome,
        city: cidade,
        uf,
        segment: filtros.segment,
        porte,
        phone: telefone,

        whatsapp: ehCelular(telefone)
          ? telefone
          : null,

        website:
          lugar.websiteUri ?? null,

        address:
          lugar.formattedAddress ?? null,

        structure: descreverEstrutura(
          porte,
          frotaPropria,
          multiUnidades,
        ),

        bombeamento,
        frotaPropria,
        multiUnidades,

        source: "google",

        signals: sinais,
      };

      return empresa;
    });

  console.log(
    "Empresas convertidas:",
    empresas.length,
  );

  /*
   * IMPORTANTE:
   *
   * Não estou filtrando por porte aqui.
   *
   * Assim você não perde leads só porque
   * o Google tem poucas avaliações daquela empresa.
   *
   * O porte continua aparecendo como estimativa.
   */

  console.log(
    "RESULTADO FINAL:",
    empresas.length,
  );

  console.log(
    "======================================",
  );

  return empresas;
}

/**
 * Busca todas as páginas disponíveis
 * para uma única consulta do Google Places.
 *
 * Atualmente o Google Text Search (New)
 * limita uma consulta a até 60 resultados.
 */
async function buscarTodasPaginas(
  textQuery: string,
  chave: string,
): Promise<LugarGoogle[]> {
  const todos: LugarGoogle[] = [];

  let pageToken: string | undefined;
  let pagina = 1;

  do {
    console.log(
      `Buscando página ${pagina}...`,
    );

    const body: {
      textQuery: string;
      languageCode: string;
      regionCode: string;
      pageSize: number;
      pageToken?: string;
    } = {
      textQuery,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 20,
    };

    if (pageToken) {
      body.pageToken = pageToken;
    }

    const resposta = await fetch(
      ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-Goog-Api-Key":
            chave,

          "X-Goog-FieldMask":
            CAMPOS,
        },

        body: JSON.stringify(body),

        cache: "no-store",
      },
    );

    if (!resposta.ok) {
      const detalhe =
        await resposta.text();

      throw new Error(
        `Google Places respondeu ${resposta.status}: ${detalhe.slice(0, 500)}`,
      );
    }

    const dados =
      (await resposta.json()) as PlacesResposta;

    const resultados =
      dados.places ?? [];

    console.log(
      `Página ${pagina}: ${resultados.length} resultados`,
    );

    todos.push(...resultados);

    pageToken =
      dados.nextPageToken;

    pagina++;
  } while (pageToken);

  return todos;
}

function estimarPorte(
  avaliacoes: number,
  temSite: boolean,
): Porte {
  if (
    avaliacoes >= 80 ||
    (avaliacoes >= 40 &&
      temSite)
  ) {
    return "grande";
  }

  if (
    avaliacoes >= 12 ||
    temSite
  ) {
    return "medio";
  }

  return "pequeno";
}
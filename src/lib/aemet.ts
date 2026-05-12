const AEMET_SOURCE_NAME = "AEMET";
const AEMET_SOURCE_URL = "https://www.aemet.es/xml/playas/play_v2_0801502.xml";
const AEMET_CACHE_TTL_MS = 30 * 60 * 1000;

export type AemetBeachForecastDay = {
  fecha: string;
  cielo: {
    manana: string | null;
    tarde: string | null;
  };
  viento: {
    manana: string | null;
    tarde: string | null;
  };
  oleaje: {
    manana: string | null;
    tarde: string | null;
  };
  temperaturaMaxima: number | null;
  temperaturaAgua: number | null;
  uv: number | null;
};

export type AemetBeachForecast = {
  fuente: string;
  fuenteUrl: string;
  playa: string;
  elaborado: string | null;
  dias: AemetBeachForecastDay[];
};

export type AemetBeachForecastResult = {
  ok: boolean;
  data: AemetBeachForecast | null;
  stale: boolean;
  cachedAt: string | null;
  error: string | null;
};

type AemetCacheState = {
  value: AemetBeachForecast | null;
  cachedAtMs: number | null;
  expiresAtMs: number | null;
  lastError: string | null;
  inFlight: Promise<AemetBeachForecast> | null;
};

const cacheState: AemetCacheState = {
  value: null,
  cachedAtMs: null,
  expiresAtMs: null,
  lastError: null,
  inFlight: null,
};

function decodeXmlLatin1(buffer: ArrayBuffer) {
  return new TextDecoder("iso-8859-1").decode(buffer);
}

function extractSingleTag(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function extractAttribute(xmlFragment: string, attributeName: string) {
  const match = xmlFragment.match(new RegExp(`${attributeName}="([^"]*)"`, "i"));
  return match?.[1]?.trim() ?? null;
}

function extractSelfClosingTag(xmlFragment: string, tagName: string) {
  const match = xmlFragment.match(new RegExp(`<${tagName}\\b([^>]*)\\/?>`, "i"));
  return match?.[1] ?? null;
}

function toNullableNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDayField(xmlFragment: string, tagName: string) {
  const tagAttributes = extractSelfClosingTag(xmlFragment, tagName);
  if (!tagAttributes) {
    return { manana: null, tarde: null };
  }

  return {
    manana: extractAttribute(tagAttributes, "descripcion1"),
    tarde: extractAttribute(tagAttributes, "descripcion2"),
  };
}

function normalizeDayNumeric(xmlFragment: string, tagName: string) {
  const tagAttributes = extractSelfClosingTag(xmlFragment, tagName);
  if (!tagAttributes) return null;
  return toNullableNumber(extractAttribute(tagAttributes, "valor1"));
}

export function parseAemetBeachForecastXml(xml: string): AemetBeachForecast {
  const playa = extractSingleTag(xml, "nombre");
  const elaborado = extractSingleTag(xml, "elaborado");
  const dayMatches = [...xml.matchAll(/<dia\b([^>]*)>([\s\S]*?)<\/dia>/gi)];

  const dias = dayMatches.map((match) => ({
    fecha: extractAttribute(match[1], "fecha") ?? "",
    cielo: normalizeDayField(match[2], "estado_cielo"),
    viento: normalizeDayField(match[2], "viento"),
    oleaje: normalizeDayField(match[2], "oleaje"),
    temperaturaMaxima: normalizeDayNumeric(match[2], "t_maxima"),
    temperaturaAgua: normalizeDayNumeric(match[2], "t_agua"),
    uv: normalizeDayNumeric(match[2], "uv_max"),
  }));

  if (!playa || !dias.length) {
    throw new Error("XML AEMET inválido o sin días de predicción.");
  }

  return {
    fuente: AEMET_SOURCE_NAME,
    fuenteUrl: AEMET_SOURCE_URL,
    playa,
    elaborado,
    dias,
  };
}

export async function fetchAemetBeachForecast(): Promise<AemetBeachForecast> {
  const response = await fetch(AEMET_SOURCE_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`AEMET respondió ${response.status}.`);
  }

  const xml = decodeXmlLatin1(await response.arrayBuffer());
  return parseAemetBeachForecastXml(xml);
}

async function refreshAemetBeachForecast() {
  const now = Date.now();
  const fresh = await fetchAemetBeachForecast();
  cacheState.value = fresh;
  cacheState.cachedAtMs = now;
  cacheState.expiresAtMs = now + AEMET_CACHE_TTL_MS;
  cacheState.lastError = null;
  return fresh;
}

export async function getCachedAemetBeachForecast(options?: { forceRefresh?: boolean }): Promise<AemetBeachForecastResult> {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cacheState.value && cacheState.expiresAtMs && cacheState.expiresAtMs > now) {
    return {
      ok: true,
      data: cacheState.value,
      stale: false,
      cachedAt: cacheState.cachedAtMs ? new Date(cacheState.cachedAtMs).toISOString() : null,
      error: null,
    };
  }

  if (!cacheState.inFlight) {
    cacheState.inFlight = refreshAemetBeachForecast().finally(() => {
      cacheState.inFlight = null;
    });
  }

  try {
    const data = await cacheState.inFlight;
    return {
      ok: true,
      data,
      stale: false,
      cachedAt: cacheState.cachedAtMs ? new Date(cacheState.cachedAtMs).toISOString() : null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la previsión AEMET.";
    cacheState.lastError = message;

    if (cacheState.value) {
      return {
        ok: true,
        data: cacheState.value,
        stale: true,
        cachedAt: cacheState.cachedAtMs ? new Date(cacheState.cachedAtMs).toISOString() : null,
        error: message,
      };
    }

    return {
      ok: false,
      data: null,
      stale: true,
      cachedAt: null,
      error: message,
    };
  }
}

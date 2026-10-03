/**
 * Núcleo: funciones de alto nivel sobre geuextws.asmx.
 * Reutilizadas por el servidor MCP y por el CLI.
 */
import { parseKvp, soapCall } from "./client.js";
import { DEFAULT_SRS } from "./config.js";
import { loadIdentity, saveIdentity, validateIdentity, type CitizenIdentity } from "./identity.js";
import type { CreateAvisoFromPhotoInput, CreateAvisoInput, CreateFields } from "./types.js";
import {
  downscaleForVision,
  loadPhotoBuffer,
  parsePhoto,
  previewToken,
  resolveUpload,
  saveUpload,
  type PhotoInfo,
} from "./photo.js";

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

export async function getIdentity(): Promise<CitizenIdentity | null> {
  return loadIdentity();
}

export async function setIdentity(identity: CitizenIdentity): Promise<{ saved: boolean }> {
  await saveIdentity(identity);
  return { saved: true };
}

export async function resolveIdentity(override?: {
  userEmail?: string;
  lang?: "es" | "ast";
}): Promise<CitizenIdentity> {
  const stored = await loadIdentity();
  const merged: CitizenIdentity = {
    userEmail: override?.userEmail ?? stored?.userEmail ?? "",
    lang: override?.lang ?? stored?.lang ?? "es",
  };
  const errors = validateIdentity(merged);
  if (errors.length) {
    throw new Error(`Falta identidad válida (${errors.join(" ")}). Pide el email al humano una vez y guárdalo con set_identity.`);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Tipos (categorías)
// ---------------------------------------------------------------------------

export interface Tipo {
  code: string;
  name: string;
}

/** Tipos de incidencia (kvp "ALU=Alumbrado&..."). Sin auth. */
export async function listCategories(lang = "es"): Promise<Tipo[]> {
  const raw = await soapCall("GetTiposIncidenciasSmartphone", { idioma: lang });
  const kv = parseKvp(raw.replace(/&amp;/g, "&"));
  return Object.entries(kv).map(([code, name]) => ({ code, name }));
}

export async function getCategory(code: string, lang = "es"): Promise<Tipo> {
  const tipos = await listCategories(lang);
  const t = tipos.find((x) => x.code === code);
  if (!t) throw new Error(`Tipo desconocido: ${code}. Mira list_categories.`);
  return t;
}

const HINT_STOPWORDS = new Set(
  "el la los las un una unos unas en de del al y o con por para que se hay son es esta este esto eso esa ese aqui hay muy mas".split(" "),
);

export interface CategorySuggestion {
  code: string;
  visible_name: string;
  score: number;
}

export async function suggestCategories(hint?: string, limit = 5): Promise<CategorySuggestion[]> {
  const tipos = await listCategories();
  const all = tipos.map((t) => ({ code: t.code, visible_name: t.name, score: 0 }));
  if (!hint?.trim()) return all.slice(0, limit);
  const words = hint.toLowerCase().split(/[^a-záéíóúñü0-9]+/u).filter((w) => w.length > 2 && !HINT_STOPWORDS.has(w));
  for (const c of all) {
    const name = c.visible_name.toLowerCase();
    for (const w of words) if (name.includes(w)) c.score += 3;
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------

export interface CreateResult {
  dry_run: boolean;
  fields: CreateFields;
  response?: unknown;
}

/** Foto como data URL (como la manda la app tras redimensionar). */
async function photoDataUrl(image_path?: string, image_base64?: string, file_id?: string): Promise<string> {
  const buf = await loadPhotoBuffer(image_base64, image_path, file_id);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/**
 * Crea un aviso. Por defecto DRY-RUN (no envía nada). Solo con confirm=true
 * hace el SOAP real — un aviso real municipal.
 */
export async function createAviso(input: CreateAvisoInput): Promise<CreateResult> {
  const idn = await resolveIdentity(input.identity);
  await getCategory(input.tipo, idn.lang);
  const foto = input.image_path ? await photoDataUrl(input.image_path) : "";
  const fields: CreateFields = {
    latitud: String(input.lat),
    longitud: String(input.lon),
    srs: DEFAULT_SRS,
    tipo: input.tipo,
    descripcion: input.description,
    idioma: idn.lang,
    mail: idn.userEmail.trim(),
    direccion: input.address,
    foto,
  };
  if (!input.confirm) return { dry_run: true, fields };
  const raw = await soapCall("InsertIncidenciaSmartphone", { ...fields });
  return { dry_run: false, fields: { ...fields, foto: foto ? `(data URL, ${foto.length} chars)` : "" }, response: parseKvp(raw) };
}

// ---------------------------------------------------------------------------
// Aviso desde foto (fases: tipo, preview; luego envío)
// ---------------------------------------------------------------------------

export type FromPhotoResult =
  | {
      phase: "need_category";
      photo: PhotoInfo;
      gps: { lat: number; lon: number; from: "exif" | "manual" } | null;
      saved_image_path: string;
      suggestions: CategorySuggestion[];
      next: string;
    }
  | {
      phase: "preview";
      preview_token: string;
      photo: PhotoInfo;
      gps: { lat: number; lon: number; from: "exif" | "manual" } | null;
      saved_image_path: string;
      category: Tipo;
      fields: CreateFields;
      description_drafted: boolean;
      image_resized: boolean;
      preview_image_base64: string;
      how_to_confirm: string;
    }
  | {
      phase: "sent";
      fields: CreateFields;
      response: unknown;
      saved_image_path: string;
      next: string;
    };

export async function createAvisoFromPhoto(input: CreateAvisoFromPhotoInput): Promise<FromPhotoResult> {
  const buf = await loadPhotoBuffer(input.image_base64, input.image_path, input.file_id);
  const small = downscaleForVision(buf);
  const photo = parsePhoto(small.resized ? small.buffer : buf);
  const saved_image_path = input.image_path ?? (input.file_id ? resolveUpload(input.file_id) : await saveUpload(buf));
  const preview_image_base64 = `data:image/jpeg;base64,${small.buffer.toString("base64")}`;

  const lat = input.lat ?? photo.gps?.lat;
  const lon = input.lon ?? photo.gps?.lng;
  const gps =
    lat !== undefined && lon !== undefined
      ? { lat, lon, from: (input.lat !== undefined ? "manual" : "exif") as "manual" | "exif" }
      : null;

  const idn = await resolveIdentity(input.identity);
  if (!input.tipo) {
    const suggestions = await suggestCategories(input.category_hint ?? input.description);
    return {
      phase: "need_category",
      photo,
      gps,
      saved_image_path,
      suggestions,
      next: "Elige un código de suggestions y repite la llamada con tipo. Nada se ha enviado.",
    };
  }
  const category = await getCategory(input.tipo, idn.lang);

  if (!input.address || gps === null) {
    throw new Error(
      "Falta ubicación: pasa address (calle y número) + lat/lon" +
        (photo.exif_warning ? ` (nota foto: ${photo.exif_warning})` : "") +
        ".",
    );
  }

  let description_drafted = false;
  let description = input.description?.trim();
  if (!description) {
    description_drafted = true;
    const when = photo.taken_at ? ` (foto del ${photo.taken_at})` : "";
    const what = input.category_hint?.trim() ? ` ${input.category_hint.trim()}` : "";
    description = `Incidencia reportada con foto${when}.${what} Revisar descripción antes de enviar.`.trim();
  }

  const fields: CreateFields = {
    latitud: String(gps.lat),
    longitud: String(gps.lon),
    srs: DEFAULT_SRS,
    tipo: input.tipo,
    descripcion: description,
    idioma: idn.lang,
    mail: idn.userEmail.trim(),
    direccion: input.address,
    foto: `data:image/jpeg;base64,${buf.toString("base64")}`,
  };
  const token = previewToken({ ...fields, foto: buf.length });

  if (!input.confirm) {
    return {
      phase: "preview",
      preview_token: token,
      photo,
      gps,
      saved_image_path,
      category,
      fields: { ...fields, foto: `(data URL, ${fields.foto.length} chars)` },
      description_drafted,
      image_resized: small.resized,
      preview_image_base64,
      how_to_confirm:
        "MUESTRA este preview al humano y espera su 'sí'. Solo entonces repite la llamada con los MISMOS campos + confirm:true + human_confirmed:true + este preview_token. Si cambias cualquier campo, pide un preview nuevo.",
    };
  }
  if (input.human_confirmed !== true) {
    throw new Error("Envío bloqueado: falta la confirmación humana. Muestra el preview y repite con human_confirmed:true + preview_token.");
  }
  if (input.preview_token !== token) {
    throw new Error("preview_token inválido o desactualizado (algún campo cambió). Repite el preview. Nada se ha enviado.");
  }
  const sent = await createAviso({
    tipo: input.tipo,
    description,
    address: input.address,
    lat: gps.lat,
    lon: gps.lon,
    image_path: saved_image_path,
    identity: input.identity,
    confirm: true,
  });
  return { phase: "sent", fields: sent.fields, response: sent.response, saved_image_path, next: "Aviso creado." };
}

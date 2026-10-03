/**
 * Construcción del servidor MCP y registro de tools.
 * Compartido por la entrada stdio (server.ts) y la HTTP (http.ts).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";
import { z } from "zod";
import { GijonApiError } from "./client.js";
import {
  createAviso,
  createAvisoFromPhoto,
  getCategory,
  getIdentity,
  listCategories,
  setIdentity,
  suggestCategories,
} from "./avisos.js";
import { CreateAvisoFromPhotoInput, CreateAvisoInput, IdentityOverride } from "./types.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
async function run<T>(fn: () => Promise<T>) {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof GijonApiError) return fail(`Error ${e.status}: ${JSON.stringify(e.body)}`);
    return fail(String(e));
  }
}

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG_VERSION: string = (require("../package.json") as { version?: string }).version ?? "0.0.0";

export function buildServer(): McpServer {
  const server = new McpServer({ name: "gijon-avisos", version: PKG_VERSION });

  server.tool(
    "get_identity",
    "Devuelve la identidad guardada (email, idioma) o null si aún no se preguntó.",
    {},
    () => run(() => getIdentity()),
  );

  server.tool(
    "set_identity",
    "Guarda el email del comunicante (se pregunta UNA vez y se reutiliza; es la identidad del aviso).",
    {
      userEmail: z.string().describe("email del comunicante"),
      lang: z.enum(["es", "ast"]).describe("idioma"),
    },
    (input) => run(() => setIdentity(input)),
  );

  server.tool(
    "list_categories",
    "Tipos de incidencia (ALU, VIA, SEM, SEN, VER). Sin auth.",
    { lang: z.enum(["es", "ast"]).optional() },
    ({ lang }) => run(() => listCategories(lang ?? "es")),
  );

  server.tool(
    "get_category",
    "Detalle de un tipo (código y nombre).",
    { code: z.string(), lang: z.enum(["es", "ast"]).optional() },
    ({ code, lang }) => run(() => getCategory(code, lang ?? "es")),
  );

  server.tool(
    "suggest_categories",
    "Sugiere tipos por palabras (p.ej. 'farola apagada').",
    { hint: z.string().optional() },
    ({ hint }) => run(() => suggestCategories(hint)),
  );

  server.tool(
    "create_aviso",
    "Crea un aviso. IMPORTANTE: por defecto es DRY-RUN (confirm=false) y solo devuelve los campos que se enviarían, SIN crear nada. Para crear de verdad hay que pasar confirm=true. Usa el email guardado salvo 'identity'.",
    CreateAvisoInput.shape,
    (input) => run(() => createAviso(input as CreateAvisoInput)),
  );

  server.tool(
    "create_aviso_from_photo",
    "Aviso desde una FOTO en fases. VÍA PREFERIDA: sube la foto con PUT /upload (curl) y pasa file_id; por stdio usa image_path local. Sin tipo → sugiere (need_category). Con todo → preview + preview_token SIN enviar. Envío: MISMOS campos + confirm:true + human_confirmed:true + preview_token (tras 'sí' humano). Sin las tres NO se envía. La foto viaja en el mismo envío (data URL).",
    CreateAvisoFromPhotoInput.shape,
    (input) => run(() => createAvisoFromPhoto(input as CreateAvisoFromPhotoInput)),
  );

  return server;
}

export { IdentityOverride };

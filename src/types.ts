/**
 * Esquemas (zod) de entrada de las herramientas.
 * tipo = código de list_categories (ALU, VIA, SEM, SEN, VER).
 */
import { z } from "zod";

export const IdentityOverride = z
  .object({
    userEmail: z.string().optional(),
    lang: z.enum(["es", "ast"]).optional(),
  })
  .describe("Sobrescribe la identidad guardada solo para esta llamada");

export const CreateAvisoInput = z.object({
  tipo: z.string().describe("código de list_categories (ALU, VIA, SEM, SEN, VER)"),
  description: z.string().describe("descripción del problema (texto que se publicará)"),
  address: z.string().describe("dirección en texto libre (calle y número)"),
  lat: z.number().describe("latitud WGS84"),
  lon: z.number().describe("longitud WGS84"),
  image_path: z.string().optional().describe("ruta local a UNA foto (se manda como data URL)"),
  identity: IdentityOverride.optional(),
  confirm: z.boolean().optional().describe("DEBE ser true para ENVIAR de verdad. Por defecto false = dry-run."),
});
export type CreateAvisoInput = z.infer<typeof CreateAvisoInput>;

export const CreateAvisoFromPhotoInput = z.object({
  image_base64: z.string().optional(),
  image_path: z.string().optional().describe("ruta local. Solo stdio/CLI en la máquina del servidor"),
  file_id: z.string().optional().describe("VÍA PREFERIDA en remoto: id de PUT /upload"),
  tipo: z.string().optional().describe("código ALU/VIA/SEM/SEN/VER. Si falta, devuelve sugerencias y no crea nada"),
  category_hint: z.string().optional(),
  description: z.string().optional().describe("si falta, se pre-rellena y se marca para revisión"),
  address: z.string().optional(),
  lat: z.number().optional().describe("sobrescribe el GPS EXIF de la foto"),
  lon: z.number().optional().describe("sobrescribe el GPS EXIF de la foto"),
  identity: IdentityOverride.optional(),
  confirm: z.boolean().optional().describe("true = ENVIAR de verdad (requiere preview_token + human_confirmed)"),
  preview_token: z.string().optional(),
  human_confirmed: z.boolean().optional().describe("el humano vio el preview y dijo 'sí'"),
});
export type CreateAvisoFromPhotoInput = z.infer<typeof CreateAvisoFromPhotoInput>;

/** Campos del InsertIncidenciaSmartphone (nombres del template de la app). */
export interface CreateFields {
  latitud: string;
  longitud: string;
  srs: string;
  tipo: string;
  descripcion: string;
  idioma: string;
  mail: string;
  direccion: string;
  foto: string;
}

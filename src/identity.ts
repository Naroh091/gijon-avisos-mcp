/**
 * Perfil del comunicante. La app "CuidaGijón" pide el email una sola vez
 * y lo reutiliza en cada aviso (getUserPromise). No pide nombre ni teléfono.
 * Este MCP hace lo mismo: `set_identity` lo guarda en JSON local (0600).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { IDENTITY_STORE } from "./config.js";

export type Lang = "es" | "ast";

export interface CitizenIdentity {
  /** Email del comunicante. Obligatorio (es la identidad). */
  userEmail: string;
  /** Idioma de tipos y del aviso. */
  lang: Lang;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateIdentity(i: CitizenIdentity): string[] {
  const errors: string[] = [];
  if (!i.userEmail?.trim() || !EMAIL_RE.test(i.userEmail.trim())) {
    errors.push("userEmail: introduce un email válido (es la identidad del aviso).");
  }
  if (i.lang !== "es" && i.lang !== "ast") errors.push("lang: 'es' o 'ast'.");
  return errors;
}

export async function loadIdentity(store = IDENTITY_STORE): Promise<CitizenIdentity | null> {
  try {
    const raw = await readFile(store, "utf8");
    return JSON.parse(raw) as CitizenIdentity;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: CitizenIdentity, store = IDENTITY_STORE): Promise<void> {
  const errors = validateIdentity(identity);
  if (errors.length) throw new Error(`Identidad inválida: ${errors.join(" ")}`);
  await mkdir(dirname(store), { recursive: true });
  await writeFile(store, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

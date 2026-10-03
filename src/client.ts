/**
 * Cliente SOAP mínimo para geuextws.asmx (sin auth).
 * Operaciones de la app: GetTiposIncidenciasSmartphone, InsertIncidenciaSmartphone.
 */
import { API_URL } from "./config.js";

export class GijonApiError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: unknown,
  ) {
    super(`Gijón API ${status} en ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.name = "GijonApiError";
  }
}

/** Escapa un valor para incrustarlo en el XML (como el template de la app). */
export function xmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function envelope(operation: string, fields: Record<string, string>): string {
  const inner = Object.entries(fields)
    .map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><${operation} xmlns="http://tempuri.org/">${inner}</${operation}></soap:Body></soap:Envelope>`
  );
}

/** Extrae el texto de <OperationResult> de la respuesta. */
export function extractResult(xml: string, operation: string): string {
  const m = xml.match(new RegExp(`<${operation}Result>([\\s\\S]*?)</${operation}Result>`));
  if (!m) throw new Error(`Respuesta sin <${operation}Result>: ${xml.slice(0, 300)}`);
  return m[1];
}

/** Lanza una operación SOAP y devuelve el texto del Result. */
export async function soapCall(operation: string, fields: Record<string, string>): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"http://tempuri.org/${operation}"`,
    },
    body: envelope(operation, fields),
  });
  const text = await res.text();
  if (!res.ok) throw new GijonApiError(res.status, API_URL, text.slice(0, 500));
  if (text.includes("<soap:Fault>")) throw new GijonApiError(500, API_URL, text.slice(0, 500));
  return extractResult(text, operation);
}

/** Parsea el formato kvp "A=B&C=D" que devuelve el servicio. */
export function parseKvp(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of s.split("&")) {
    const i = pair.indexOf("=");
    if (i < 0) continue;
    out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

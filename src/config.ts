/**
 * Configuración del sistema de avisos de Gijón (CuidaGijón).
 *
 * Valores extraídos por ingeniería inversa del APK "CuidaGijón"
 * (es.gijon.cuidagijon v2.5.1, app híbrida Cordova; lógica en assets/www)
 * y verificados con llamadas reales de lectura.
 *
 * Auth: NINGUNA. El SOAP municipal no pide credenciales.
 * La identidad del comunicante es solo su email (se registra una vez en la app).
 */
import { homedir } from "node:os";
import { join } from "node:path";

/** Servicio SOAP municipal (operaciones GetTipos/InsertIncidenciaSmartphone). */
export const API_URL =
  process.env.GIJON_AVISOS_API_URL ??
  "https://viamap.gijon.es/viamap/geuextws/geuextws.asmx";

/** SRS que manda la app en cada aviso. */
export const DEFAULT_SRS = process.env.GIJON_AVISOS_SRS ?? "EPSG:4326";

/**
 * Fichero donde vive el perfil del comunicante (email, idioma).
 * Se pregunta UNA vez tras la instalación (ver skill) y se reutiliza.
 * Modo 0600: son datos personales.
 */
export const IDENTITY_STORE =
  process.env.GIJON_AVISOS_IDENTITY_STORE ??
  join(homedir(), ".config", "gijon-avisos", "identity.json");

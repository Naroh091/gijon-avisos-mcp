---
name: gijon-avisos
description: "Crea avisos al Ayto. de Gijón desde una foto"
version: 0.1.0
platforms: [linux, macos]
metadata:
  hermes:
    tags: [gijon, xixon, avisos, ayuntamiento, incidencias, mcp]
    category: civic
---

# Avisos Gijón — incidencias desde una foto

Servidor MCP `gijon-avisos` (7 tools, prefijo `mcp__gijon_avisos__`).
Sin autenticación: el SOAP municipal no pide credenciales. Todo aviso que crees
es REAL. **Solo incidencias genuinas. Nada de pruebas.**

## When to Use

Foto de incidencia urbana en Gijón + petición de avisar al Ayuntamiento. Usa
SOLO imagen + tools `mcp__gijon_avisos__*`. NO explores la máquina.

## Setup (una sola vez)

La app solo pide el email una vez y lo reutiliza. Pídelo UNA vez con idioma
(`es`, la app también acepta `ast`) y guárdalo con `set_identity`. Comprueba
con `get_identity`; si es `null`, pregunta antes de seguir. No hay nada más
que configurar: sin tokens, sin cuentas.

## Procedure

### 0. Foto

NO abras la original con visión: usa `preview_image_base64`. En stdio local
`image_path`; en remoto `PUT /upload` + `file_id`; `image_base64` solo para
fotos pequeñas visibles. Sin GPS EXIF no adivines: pide calle + `lat`/`lon`.
La dirección es texto libre (la app no tiene selector de portal).

### 1. Tipo

`create_aviso_from_photo` con la foto + `category_hint`. `need_category` →
enseña `suggestions` (ALU, VIA, SEM, SEN, VER; detalle en `get_category`) y
repite con `tipo`.

### 2. Preview (NUNCA envía nada)

Con tipo + `address` + `lat`/`lon` responde `preview`. Enséñalo al humano
(tipo, dirección, coords, descripción, email) y guarda el `preview_token`:
cualquier cambio exige preview nuevo. Descripción pre-rellenada
(`description_drafted: true`) la revisa el humano.

### 3. Envío (solo con el "sí" explícito)

MISMOS campos + `confirm: true` + `human_confirmed: true` + `preview_token`.
Sin las tres, bloquea. Solo `phase: "sent"` acredita el envío. La foto viaja
en el mismo envío como data URL; no hay adjunto separado.

## Pitfalls

- Sin email guardado las tools fallan: `set_identity` primero.
- Inventar `tipo`: usa `list_categories`/`suggest_categories`.
- Cambiar campos entre preview y envío invalida el token.
- Sin EXIF (capturas, recomprimidas) pide ubicación manual.

## Verification

- `list_categories` → 5 tipos, sin auth.
- El `Insert` real aún no se ha estrenado: avisa antes del primer envío.

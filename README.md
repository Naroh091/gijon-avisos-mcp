# gijon-avisos-mcp

Servidor **MCP** (y CLI de apoyo) para el sistema de avisos del Ayuntamiento de Gijón
(CuidaGijón). Permite a un agente listar tipos de incidencia y crear avisos con
inteligencia artificial — incluso desde una foto. Sin autenticación: el servicio
municipal no pide credenciales.

La finalidad de este proyecto es hacer más fácil que los ciudadanos puedan reportar
problemas al Ayuntamiento de Gijón. Saca una foto de la incidencia (una farola
fundida, una baldosa rota, un semáforo apagado…), pásasela al agente pidiéndole que
genere un aviso para que describa el problema, seleccione el tipo, añada la ubicación
y lance el aviso al Ayuntamiento.

- [Inicio rápido](#inicio-rápido)
- [Fotos demasiado grandes para el modelo](#fotos-demasiado-grandes-para-el-modelo)
- [¿Eres un agente IA? Lee esto primero](#eres-un-agente-ia-lee-esto-primero)
- [Añadir el MCP vía npx](#añadir-el-mcp-vía-npx)
- [Herramientas MCP](#herramientas-mcp)
- [Configuración](#configuración)
- [Uso como CLI](#uso-como-cli)
- [Servidor HTTP (opcional, avanzado)](#servidor-http-opcional-avanzado)
- [Arquitectura](#arquitectura)

## Inicio rápido

Gijón no usa credenciales: el SOAP municipal acepta llamadas directas y cada aviso
lleva el email del comunicante.

1. Añade el servidor a tu cliente MCP ([ejemplos](#añadir-el-mcp-vía-npx)) o
   configúralo a mano:

```json
{
  "mcpServers": {
    "gijon-avisos": {
      "command": "npx",
      "args": ["-y", "gijon-avisos-mcp"]
    }
  }
}
```

2. Verifica: `list_categories` debe devolver los 5 tipos (ALU, VIA, SEM, SEN, VER).
3. Pregunta al humano UNA vez su email y guárdalo con la tool `set_identity`.
   Se reutiliza en todos los avisos.
4. Flujo del agente: `create_aviso_from_photo` (foto → tipo → preview) → enseña
   el preview al humano → `confirm: true` + `human_confirmed: true` +
   `preview_token` solo con su "sí".

Todo corre en tu máquina; los avisos se crean con el email guardado.

## Fotos demasiado grandes para el modelo

Algunos modelos rechazan fotos muy grandes (`image decode limit exceeded`). El servidor
reduce en TypeScript (sin dependencias) conservando el GPS, así que el modelo nunca
necesita procesar la original:

* **Remoto (HTTP)**: sube la foto con curl y usa el `file_id` (los bytes no pasan por el
  modelo). Requiere el secreto del servidor:
  ```bash
  curl -X PUT --data-binary @foto.jpg \
    -H "Authorization: Bearer ***" \
    'http://127.0.0.1:3002/upload?filename=foto.jpg'
  # → {"file_id":"…","bytes":…}
  ```
  El preview devuelve `preview_image_base64` (copia reducida) para visión y el envío
  usa siempre la original como data URL.
* **Local (stdio/CLI)**: pasa `image_path`; el servidor lee y reduce sin que el modelo
  abra el fichero. O reduce tú con `node dist/cli.js prep-photo foto.jpg [foto-ligera.jpg]`.

## ¿Eres un agente IA? Lee esto primero

La skill (`skill/SKILL.md`) no se autoinstala: cópiala al directorio de tu cliente
y abre sesión nueva.

```bash
cp -r skill ~/.hermes/skills/gijon-avisos        # Hermes
cp -r skill ~/.claude/skills/gijon-avisos        # Claude Code
# o descárgala: https://github.com/Naroh091/gijon-avisos-mcp/blob/main/skill/SKILL.md
```

Instálalo así (requiere Node 18+):

1. **Sin credenciales**: este MCP no necesita tokens ni cuentas. Solo el email del
   humano (paso 3 del [inicio rápido](#inicio-rápido)).
2. **Instalación** según tu cliente ([comandos exactos](#añadir-el-mcp-vía-npx)):
   Claude Code (`claude mcp add … -- npx -y gijon-avisos-mcp`), Hermes (`hermes mcp add …
   --command npx … --args -y gijon-avisos-mcp`) u OpenClaw (`openclaw mcp add …
   --command npx --arg -y --arg gijon-avisos-mcp`).
3. **Identidad**: pregunta el email UNA vez y guárdalo con `set_identity`
   (verifica con `get_identity`).
4. **Verifica** (`mcp list` / `test` / `doctor --probe` según cliente): debes ver 7 tools.
5. **Uso**: hay skill completa en [`skill/SKILL.md`](skill/SKILL.md).
   Lo esencial: solo incidencias genuinas; `create_aviso_from_photo` en fases
   (tipo → preview → envío solo con "sí" humano + `confirm` + `human_confirmed` +
   `preview_token`); foto por `file_id`; la dirección es texto libre y las
   coordenadas van en el aviso.

## Añadir el MCP vía npx

Requiere Node 18+.

### Claude Code

```bash
claude mcp add gijon-avisos -- npx -y gijon-avisos-mcp
claude mcp list   # verificar
```

### Hermes

```bash
hermes mcp add gijon-avisos --command npx --args -y gijon-avisos-mcp
hermes mcp test gijon-avisos   # verificar (lista las 7 tools)
```

### OpenClaw

```bash
openclaw mcp add gijon-avisos \
  --command npx \
  --arg -y \
  --arg gijon-avisos-mcp \
openclaw mcp doctor gijon-avisos --probe   # verificar
```

### Desde código

```bash
npm install
npm run build
npx -y -p gijon-avisos-mcp gijon-avisos-mcp-http   # HTTP en 127.0.0.1:3002/mcp
```

## Herramientas MCP

| Tool | Qué hace |
|---|---|
| `get_identity` | Email guardado del comunicante (o null). |
| `set_identity` | Guarda el email (se pregunta una vez). |
| `list_categories` | Tipos de incidencia: ALU, VIA, SEM, SEN, VER. |
| `get_category` | Detalle de un tipo (código y nombre). |
| `suggest_categories` | Sugiere tipos por palabras. |
| `create_aviso` | Crea un aviso. **Dry-run por defecto**; `confirm: true` para enviar. |
| `create_aviso_from_photo` | Aviso desde foto en fases: tipo → preview (GPS EXIF) y envío solo con `confirm: true` + `human_confirmed: true` + `preview_token`. Acepta `image_base64`, `image_path` o `file_id`. |

### Seguridad de envío

`create_aviso` es **dry-run por defecto**: devuelve los campos **sin crear nada**. Solo con
`confirm: true` hace el SOAP real — un aviso real que revisa personal municipal.
Envía únicamente incidencias reales.

`create_aviso_from_photo` exige confirmación humana en fases:

1. **Tipo** (sin `tipo`): sugiere y no envía nada.
2. **Preview** (`confirm` ausente/false): GPS EXIF (o `lat`/`lon` manuales),
   dirección en texto libre, payload + `preview_token`. No envía nada.
3. **Envío**: el agente muestra el preview al humano y espera su "sí"; solo entonces
   repite la llamada con los MISMOS campos + `confirm: true` + `human_confirmed: true` +
   `preview_token`. Si cambió cualquier campo, hay que repetir el preview.

## Tipos de incidencia

- **ALU** — Alumbrado (farolas fundidas o rotas).
- **VIA** — Conservación viaria (baches, baldosas, bordillos).
- **SEM** — Red Semafórica (semáforos apagados o averiados).
- **SEN** — Señalización Viaria (señales caídas o que faltan).
- **VER** — Zonas verdes (arbolado, jardines).

## Uso como CLI

```bash
node dist/cli.js categories
node dist/cli.js identity-set nombre@example.com es
node dist/cli.js create VIA 43.5322 -5.6611 "Calle Corrida 1" -- "Baldosa rota"          # dry-run
node dist/cli.js create VIA 43.5322 -5.6611 "Calle Corrida 1" -- "Baldosa rota" --send   # ENVÍA de verdad
node dist/cli.js from-photo foto.jpg VIA "Baldosa rota"      # preview desde foto
node dist/cli.js prep-photo foto.jpg [foto-ligera.jpg]   # reduce para el modelo, conserva EXIF/GPS
```

## Servidor HTTP (opcional)

Por stdio cada uno corre su copia. La entrada **HTTP** sirve para exponer el servidor
que corre en TU máquina para que un agente en OTRA máquina lo use.

```bash
export GIJON_AVISOS_MCP_SECRET=<un-secreto-largo>            # exige x-mcp-secret o Bearer
export GIJON_AVISOS_ALLOWED_HOSTS=tu-host.tu-tailnet.ts.net  # anti DNS-rebinding
npm run start:http     # 127.0.0.1:3002/mcp
```

Variables: `GIJON_AVISOS_HTTP_PORT` (3002), `GIJON_AVISOS_HTTP_HOST` (127.0.0.1),
`GIJON_AVISOS_HTTP_PATH` (/mcp). Expón solo en red privada (p.ej. `tailscale serve`,
nunca `funnel`). Para persistencia, `launchd`/`pm2`/`tmux` o similar.

## Arquitectura

- `src/client.ts` — SOAP mínimo (`GetTipos/InsertIncidenciaSmartphone`), sin auth.
- `src/identity.ts` — email en JSON local (0600).
- `src/avisos.ts` — **núcleo** de negocio (reutilizado por MCP y CLI).
- `src/photo.ts` — foto: EXIF/GPS, subida a tmp, token de preview.
- `src/types.ts` — esquemas zod de entrada + campos de creación.
- `src/mcp.ts` — `buildServer()`: registra las 7 tools (compartido por stdio y HTTP).
- `src/server.ts` — entrada stdio · `src/http.ts` — entrada HTTP (`/mcp` + `PUT /upload`) · `src/cli.ts` — CLI.

## Notas

- Ingeniería inversa del APK "CuidaGijón" v2.5.1 + verificación en vivo de tipos
  y dry-runs (sin crear avisos reales).

## Licencia

AGPLv3. Ver [LICENSE](LICENSE).

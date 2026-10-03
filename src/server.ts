#!/usr/bin/env node
/**
 * Entrada STDIO del servidor MCP (para Claude Desktop / Claude Code en local).
 * Para exponerlo por red (Tailscale), usa http.ts.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./mcp.js";

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[gijon-avisos] MCP servidor listo (stdio). Sin auth: no hay credenciales que configurar.");
}

main().catch((e) => {
  console.error("[gijon-avisos] Error fatal:", e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * CLI fino sobre el mismo núcleo, para pruebas manuales.
 * Uso: gijon-avisos <comando> [args]
 *   identity | identity-set <email> [es|ast]
 *   categories [es|ast] | category <ALU|VIA|SEM|SEN|VER>
 *   create <TIPO> <lat> <lon> <dirección...> -- <descripción...> [--foto <path>]  (dry-run; --send envía)
 *   from-photo <image_path> [TIPO] [descripción]  (preview; con --send --token <tok> --yes envía)
 *   prep-photo <in.jpg> [out.jpg]
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import {
  createAviso,
  createAvisoFromPhoto,
  getCategory,
  getIdentity,
  listCategories,
  setIdentity,
} from "./avisos.js";

import { downscaleForVision, parsePhoto } from "./photo.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const send = args.includes("--send");
  const rest = args.filter((a) => a !== "--send");

  switch (cmd) {
    case "identity":
      return out((await getIdentity()) ?? { saved: false });
    case "identity-set":
      return out(
        await setIdentity({
          userEmail: rest.find((a) => a.includes("@")) ?? "",
          lang: (rest.includes("ast") ? "ast" : "es") as "es" | "ast",
        }),
      );
    case "categories":
      return out(await listCategories(rest[0] === "ast" ? "ast" : "es"));
    case "category":
      return out(await getCategory(rest[0]));
    case "create": {
      // create <TIPO> <lat> <lon> <dirección...> -- <descripción...> [--foto <path>]
      const fotoIdx = rest.indexOf("--foto");
      const foto = fotoIdx >= 0 ? rest[fotoIdx + 1] : undefined;
      const noFoto = fotoIdx >= 0 ? [...rest.slice(0, fotoIdx), ...rest.slice(fotoIdx + 2)] : rest;
      const sep = noFoto.indexOf("--");
      const head = sep >= 0 ? noFoto.slice(0, sep) : noFoto;
      const desc = sep >= 0 ? noFoto.slice(sep + 1).join(" ") : "";
      const [tipo, lat, lon, ...addr] = head;
      return out(
        await createAviso({
          tipo,
          lat: Number(lat),
          lon: Number(lon),
          address: addr.join(" "),
          description: desc,
          image_path: foto,
          confirm: send,
        }),
      );
    }
    case "from-photo": {
      const tokIdx = rest.indexOf("--token");
      const token = tokIdx >= 0 ? rest[tokIdx + 1] : undefined;
      const yes = rest.includes("--yes");
      const positional = rest.filter((a, i) => {
        if (a === "--send" || a === "--yes" || a === "--token") return false;
        if (tokIdx >= 0 && i === tokIdx + 1) return false;
        return true;
      });
      return out(
        await createAvisoFromPhoto({
          image_path: positional[0],
          tipo: positional[1],
          description: positional[2],
          confirm: send,
          preview_token: token,
          human_confirmed: yes,
        }),
      );
    }
    case "prep-photo": {
      const [input, output] = rest;
      if (!input) {
        console.error("Uso: prep-photo <in.jpg> [out.jpg]");
        process.exit(1);
      }
      const buf = await readFile(input);
      const before = parsePhoto(buf);
      const small = downscaleForVision(buf);
      const dst = output ?? input.replace(/(\.[a-zA-Z0-9]+)?$/, "-ligera$1");
      if (small.resized || dst !== input) await writeFile(dst, small.buffer);
      const stIn = await stat(input);
      const stOut = await stat(dst);
      return out({ ok: true, bytes_in: stIn.size, bytes_out: stOut.size, resized: small.resized, gps: before.gps });
    }
    default:
      console.error(
        "Comandos: identity | identity-set <email> [es|ast] | categories | category <TIPO> | create <TIPO> <lat> <lon> <dir> -- <desc> [--foto <p>] [--send] | from-photo <path> [TIPO] [desc] [--send --token <tok> --yes] | prep-photo <in> [out]",
      );
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});

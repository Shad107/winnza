// Engendre l'image de fond d'un mème : lit content/memes/<slug>.json, envoie sa consigne d'image (plus les
// règles déclarées : aucun texte dans l'image) à l'IA d'image, et écrit content/memes/<slug>.jpg.
//   node dist/meme-image.js <AAAA-MM-JJ-sujet>
// Réglages : declarations/memes.json. La dépense de l'appel est écrite, si la variable WINNZA_IMAGE_USAGE
// nomme un fichier, en une ligne JSON ajoutée à ce fichier (le passage de l'agent la compte dans son budget).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { parseMeme } from "./pages/memes.js";

const ROOT = join(import.meta.dirname, "..", "..");

const declSchema = z.object({
  image: z.object({
    url: z.string().url(), model: z.string(), size: z.string(), quality: z.string(),
    format: z.literal("jpeg"), compression: z.number().int().min(1).max(100),
    keyFile: z.string(), keyField: z.string(), timeoutSeconds: z.number().positive(), rules: z.string().min(1),
  }),
  pricing: z.object({ textInput: z.number(), imageOutput: z.number() }),
});
const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string() })).min(1),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }).optional(),
});

function apiKey(d: z.infer<typeof declSchema>["image"]): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const file = join(homedir(), d.keyFile);
  try {
    const v = (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)[d.keyField];
    if (typeof v === "string" && v) return v;
  } catch { /* message ci-dessous */ }
  throw new Error(`aucune clé : ni OPENAI_API_KEY, ni champ ${d.keyField} dans ~/${d.keyFile}`);
}

async function main() {
  const slug = process.argv[2];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("usage : meme-image <AAAA-MM-JJ-sujet>");
  const decl = declSchema.parse(JSON.parse(readFileSync(join(ROOT, "declarations", "memes.json"), "utf8")));
  const meme = parseMeme(slug, readFileSync(join(ROOT, "content", "memes", `${slug}.json`), "utf8"));
  const d = decl.image;
  const res = await fetch(d.url, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey(d)}`, "content-type": "application/json" },
    body: JSON.stringify({ model: d.model, prompt: `${meme.imagePrompt}\n\n${d.rules}`, size: d.size, quality: d.quality, output_format: d.format, output_compression: d.compression, n: 1 }),
    signal: AbortSignal.timeout(d.timeoutSeconds * 1000),
  });
  if (!res.ok) throw new Error(`IA d'image : HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = responseSchema.parse(await res.json());
  const out = join(ROOT, "content", "memes", `${slug}.jpg`);
  writeFileSync(out, Buffer.from(body.data[0]!.b64_json, "base64"));
  const u = body.usage ?? { input_tokens: 0, output_tokens: 0 };
  const costUsd = Math.round(((u.input_tokens * decl.pricing.textInput + u.output_tokens * decl.pricing.imageOutput) / 1e6) * 10000) / 10000;
  const line = { date: new Date().toISOString(), slug, model: d.model, inputTokens: u.input_tokens, outputTokens: u.output_tokens, costUsd };
  if (process.env.WINNZA_IMAGE_USAGE) appendFileSync(process.env.WINNZA_IMAGE_USAGE, JSON.stringify(line) + "\n");
  console.log(`image écrite : ${out} (${costUsd} $)`);
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });

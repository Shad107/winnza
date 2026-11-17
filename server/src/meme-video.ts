// Engendre la vidéo gag d'un mème : la photo du mème (content/memes/<slug>.jpg) sert de première image, la
// mise en scène écrite (videoPrompt du mème, plus les règles déclarées) dit ce qui s'y passe ; le modèle
// d'image vers vidéo de fal.ai l'anime, et la vidéo est écrite dans content/memes/<slug>.mp4.
//   node dist/meme-video.js <AAAA-MM-JJ-sujet>
// Réglages : declarations/memes.json (video, pricing). La clé : FAL_KEY, ou à défaut le fichier déclaré. La
// dépense est écrite, si WINNZA_IMAGE_USAGE nomme un fichier, en une ligne JSON ajoutée à ce fichier (le
// passage de l'agent la compte dans son budget, avec celle des images).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createFalClient } from "@fal-ai/client";
import { z } from "zod";
import { allowedVideoUrl, parseMeme } from "./pages/memes.js";

const ROOT = join(import.meta.dirname, "..", "..");

const declSchema = z.object({
  video: z.object({
    endpoint: z.string().min(1), duration: z.number().positive(), resolution: z.string(), promptExpansion: z.string(),
    keyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/), keyFile: z.string(), allowedHosts: z.array(z.string()).min(1),
    maxBytes: z.number().int().positive(), timeoutSeconds: z.number().positive(), rules: z.string().min(1),
  }),
  pricing: z.object({ videoPerSecond: z.number().positive() }),
});
/** ce que rend le modèle : l'adresse de la vidéo (le reste est ignoré) */
const outputSchema = z.object({ video: z.object({ url: z.string().url() }) });

type VideoDecl = z.infer<typeof declSchema>["video"];

/** La clé fal.ai : la variable d'environnement déclarée, sinon la ligne VARIABLE=valeur du fichier déclaré. */
function apiKey(d: VideoDecl): string {
  const env = process.env[d.keyEnv];
  if (env) return env;
  try {
    const line = readFileSync(join(homedir(), d.keyFile), "utf8").split("\n").find((l) => l.startsWith(`${d.keyEnv}=`));
    const v = line?.slice(d.keyEnv.length + 1).trim().replace(/^"(.*)"$/, "$1");
    if (v) return v;
  } catch { /* message ci-dessous */ }
  throw new Error(`aucune clé fal.ai : ni ${d.keyEnv}, ni ligne ${d.keyEnv}= dans ~/${d.keyFile}`);
}

async function main() {
  const slug = process.argv[2];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("usage : meme-video <AAAA-MM-JJ-sujet>");
  const decl = declSchema.parse(JSON.parse(readFileSync(join(ROOT, "declarations", "memes.json"), "utf8")));
  const meme = parseMeme(slug, readFileSync(join(ROOT, "content", "memes", `${slug}.json`), "utf8"));
  if (!meme.videoPrompt) throw new Error(`mème ${slug} : pas de videoPrompt (la mise en scène de la vidéo)`);
  const d = decl.video;
  const fal = createFalClient({ credentials: apiKey(d) });
  // la photo du mème, envoyée au stockage de fal.ai, sert de première image
  const imageUrl = await fal.storage.upload(new Blob([readFileSync(join(ROOT, "content", "memes", `${slug}.jpg`))], { type: "image/jpeg" }));
  const result = await fal.subscribe(d.endpoint, {
    input: { prompt: `${meme.videoPrompt}\n\n${d.rules}`, image_url: imageUrl, duration: d.duration, resolution: d.resolution, prompt_expansion_mode: d.promptExpansion },
    timeout: d.timeoutSeconds * 1000,
  });
  const out = outputSchema.parse(result.data);
  if (!allowedVideoUrl(out.video.url, d.allowedHosts)) throw new Error(`vidéo à une adresse inattendue (demande ${result.requestId})`);
  const res = await fetch(out.video.url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`téléchargement de la vidéo : HTTP ${res.status} (demande ${result.requestId})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > d.maxBytes) throw new Error(`vidéo de ${bytes.length} octets, au-delà de ${d.maxBytes} (demande ${result.requestId})`);
  const file = join(ROOT, "content", "memes", `${slug}.mp4`);
  writeFileSync(file, bytes);
  // dépense : la durée demandée au tarif déclaré (la vidéo peut durer jusqu'à 0,7 s de plus : estimation basse)
  const costUsd = Math.round(d.duration * decl.pricing.videoPerSecond * 10000) / 10000;
  const line = { date: new Date().toISOString(), slug, model: d.endpoint, requestId: result.requestId, seconds: d.duration, costUsd };
  if (process.env.WINNZA_IMAGE_USAGE) appendFileSync(process.env.WINNZA_IMAGE_USAGE, JSON.stringify(line) + "\n");
  console.log(`vidéo écrite : ${file} (${bytes.length} octets, environ ${costUsd} $, demande ${result.requestId})`);
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });

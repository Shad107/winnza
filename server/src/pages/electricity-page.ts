// Données de la page électricité, calculées UNIQUEMENT depuis la base (séries, sources, réglages écrits
// par le plugin électricité). Null si le plugin n'a jamais tourné ou est éteint.
import type { Observation, SiteReader } from "../contract.js";
import { addDays, parisDate } from "../units.js";
import { parseElecCatalog, TEMPO_COLOR, type Link, type TempoColor } from "../plugins/electricity/decl.js";
import { tempoSeason } from "../plugins/electricity/parse.js";
import { ELEC_CATALOG_SETTING, EU_PART, euSeriesId, SUBSCRIPTION, TEMPO_SERIES, TRV_PART, trvSeriesId } from "../plugins/electricity/series-ids.js";

/** Les quatre parts d'un kWh, dans l'ordre d'empilement (du bas vers le haut). */
export const KWH_PART = { energy: "energy", network: "network", taxes: "taxes", vat: "vat" } as const;
export type KwhPart = (typeof KWH_PART)[keyof typeof KWH_PART];
export const KWH_PARTS: readonly KwhPart[] = [KWH_PART.energy, KWH_PART.network, KWH_PART.taxes, KWH_PART.vat];
export type KwhBreakdown = Record<KwhPart, number>;

export type TrvPrice = { id: string; label: string; tempo: TempoColor | null; ttc: number; ht: number; excise: number; vat: number };
export type TrvPower = { kva: number; since: string; subscriptionTtc: number; periods: TrvPrice[] };
export type TrvOptionPage = { id: string; label: string; powers: TrvPower[] };

export type TempoToday = {
  date: string; color: TempoColor;
  /** couleur de demain, si elle est déjà publiée au moment de la collecte */
  tomorrow: TempoColor | null;
  season: string;
  used: Record<TempoColor, number>;
  quota: { white: number; red: number };
  quotaSource: Link;
};

export type ElectricityPage = {
  asOf: string;
  consumption: { default: number; min: number; max: number; step: number };
  bandLabel: string;
  kwhVat: { rate: number; source: Link };
  options: TrvOptionPage[];
  /** prix du kWh TTC en vigueur le 1er de chaque mois, pour la première puissance déclarée */
  history: { kva: number; months: string[]; series: { key: string; label: string; values: number[] }[] };
  /** composantes annuelles (Eurostat) du pays de référence */
  annual: { year: number; parts: KwhBreakdown }[];
  europe: {
    reference: string;
    /** année des composantes, date du semestre des prix */
    year: number; semester: string;
    countries: { code: string; label: string; price: number | null; parts: KwhBreakdown | null }[];
  };
  tempo: TempoToday | null;
  sources: { name: string; publisher: string; url: string }[];
};

/** Valeur en vigueur à `date` : la dernière publiée à cette date ou avant. */
function inForce(obs: Observation[], date: string): number | null {
  let v: number | null = null;
  for (const o of obs) { if (o.date > date) break; v = o.value; }
  return v;
}

const monthsFrom = (first: string, last: string): string[] => {
  const out: string[] = [];
  let y = Number(first.slice(0, 4)), m = Number(first.slice(5, 7));
  // le premier mois plein qui suit le premier tarif
  if (first.slice(8) !== "01") { m++; if (m > 12) { m = 1; y++; } }
  for (;;) {
    const d = `${y}-${String(m).padStart(2, "0")}-01`;
    if (d > last) return out;
    out.push(d);
    if (++m > 12) { m = 1; y++; }
  }
};

export function buildElectricityPage(read: SiteReader, today: string = parisDate()): ElectricityPage | null {
  const raw = read.settingOrNull(ELEC_CATALOG_SETTING);
  if (raw === null) return null;
  const cat = parseElecCatalog(raw);
  const { trv, eurostat } = cat;
  let asOf = "";

  const options = trv.options.map((o): TrvOptionPage => ({
    id: o.id, label: o.label,
    powers: trv.powers.flatMap((kva): TrvPower[] => {
      const sub = read.get(trvSeriesId(o.id, kva, SUBSCRIPTION, TRV_PART.ttc)).at(-1);
      if (!sub) return [];
      const periods = o.periods.map((p): TrvPrice => {
        const last = (part: (typeof TRV_PART)[keyof typeof TRV_PART]) => {
          const v = read.get(trvSeriesId(o.id, kva, p.id, part)).at(-1);
          if (!v || v.date !== sub.date) throw new Error(`page électricité : ${o.id} ${kva} kVA ${p.id} ${part} absent au ${sub.date}`);
          return v.value;
        };
        return { id: p.id, label: p.label, tempo: p.tempo ?? null, ttc: last(TRV_PART.ttc), ht: last(TRV_PART.ht), excise: last(TRV_PART.excise), vat: last(TRV_PART.vat) };
      });
      if (sub.date > asOf) asOf = sub.date;
      return [{ kva, since: sub.date, subscriptionTtc: sub.value, periods }];
    }),
  })).filter((o) => o.powers.length);
  if (!options.length) return null;

  // historique : les options sans couleur Tempo (Base, heures creuses, heures pleines), première puissance
  const kva = trv.powers[0]!;
  const lines = trv.options.flatMap((o) => o.periods.filter((p) => !p.tempo).map((p) => ({
    key: `${o.id}-${p.id}`, label: o.periods.length > 1 ? p.label : o.label, obs: read.get(trvSeriesId(o.id, kva, p.id, TRV_PART.ttc)),
  }))).filter((l) => l.obs.length);
  const first = lines.map((l) => l.obs[0]!.date).sort().at(-1) ?? asOf;
  const months = monthsFrom(first, today < asOf ? asOf : today);
  const history = { kva, months, series: lines.map((l) => ({ key: l.key, label: l.label, values: months.map((m) => inForce(l.obs, m) ?? 0) })) };

  // Eurostat : composantes et prix
  const partsAt = (code: string, date: string): KwhBreakdown | null => {
    const at = (part: Parameters<typeof euSeriesId>[1]) => read.get(euSeriesId(code, part)).find((o) => o.date === date)?.value;
    const energy = at(EU_PART.energy), network = at(EU_PART.network), taxes = at(EU_PART.taxes), vat = at(EU_PART.vat);
    return energy === undefined || network === undefined || taxes === undefined || vat === undefined ? null : { energy, network, taxes, vat };
  };
  const ref = eurostat.reference;
  const annual = read.get(euSeriesId(ref, EU_PART.taxes)).flatMap((o) => {
    const parts = partsAt(ref, o.date);
    return parts ? [{ year: Number(o.date.slice(0, 4)), parts }] : [];
  });
  const compDate = read.get(euSeriesId(ref, EU_PART.taxes)).at(-1)?.date ?? "";
  const semester = read.get(euSeriesId(ref, EU_PART.price)).at(-1)?.date ?? "";
  const countries = eurostat.countries.map((c) => ({
    code: c.code, label: c.label,
    price: read.get(euSeriesId(c.code, EU_PART.price)).find((o) => o.date === semester)?.value ?? null,
    parts: compDate ? partsAt(c.code, compDate) : null,
  }));

  // Tempo : la couleur du jour, et ce que la saison a déjà consommé
  const colorOf = (code: number): TempoColor | null => cat.tempo.codes[String(code)] ?? null;
  const days = read.get(TEMPO_SERIES);
  const todayObs = days.find((o) => o.date === today);
  let tempo: TempoToday | null = null;
  const color = todayObs ? colorOf(todayObs.value) : null;
  if (color) {
    const season = tempoSeason(today, cat.tempo.seasonStartMonth);
    const used: Record<TempoColor, number> = { [TEMPO_COLOR.blue]: 0, [TEMPO_COLOR.white]: 0, [TEMPO_COLOR.red]: 0 };
    for (const o of days) {
      const c = colorOf(o.value);
      if (c && o.date <= today && tempoSeason(o.date, cat.tempo.seasonStartMonth) === season) used[c]++;
    }
    const next = days.find((o) => o.date === addDays(today, 1));
    tempo = { date: today, color, tomorrow: next ? colorOf(next.value) : null, season, used, quota: cat.tempo.quota, quotaSource: cat.tempo.quotaSource };
  }

  const sourceIds = new Set<string>();
  for (const o of trv.options) { const s = read.series(trvSeriesId(o.id, kva, SUBSCRIPTION, TRV_PART.ttc)); if (s) sourceIds.add(s.sourceId); }
  for (const id of [euSeriesId(ref, EU_PART.energy), euSeriesId(ref, EU_PART.price), TEMPO_SERIES]) { const s = read.series(id); if (s) sourceIds.add(s.sourceId); }
  const sources = [...sourceIds].flatMap((id) => { const s = read.source(id); return s ? [{ name: s.name, publisher: s.publisher, url: s.url }] : []; });

  return {
    asOf, consumption: cat.page.consumption, bandLabel: eurostat.bandLabel, kwhVat: trv.kwhVat, options, history, annual,
    europe: { reference: ref, year: Number(compDate.slice(0, 4)), semester, countries },
    tempo, sources,
  };
}

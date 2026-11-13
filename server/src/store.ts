// Base SQLite : sources, séries, observations, et le journal des collectes.
import Database from "better-sqlite3";
import { UNIT, FREQUENCY, type Frequency, type Observation, type SeriesDecl, type SiteReader, type SourceDecl, type Unit } from "./contract.js";

const isUnit = (u: string): u is Unit => (Object.values(UNIT) as string[]).includes(u);
const isFrequency = (f: string): f is Frequency => (Object.values(FREQUENCY) as string[]).includes(f);

export class Store implements SiteReader {
  readonly db: Database.Database;

  /** `readonly` : le site ouvre la base en lecture seule ; seule la collecte écrit (et crée le schéma). */
  constructor(path: string, opts: { readonly?: boolean } = {}) {
    if (opts.readonly) {
      this.db = new Database(path, { readonly: true, fileMustExist: true });
      return;
    }
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, publisher TEXT NOT NULL, url TEXT NOT NULL,
        licence TEXT NOT NULL, vault_entry TEXT);
      CREATE TABLE IF NOT EXISTS series (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, unit TEXT NOT NULL, frequency TEXT NOT NULL,
        source_id TEXT NOT NULL REFERENCES source(id), derived_from TEXT);
      CREATE TABLE IF NOT EXISTS observation (
        series_id TEXT NOT NULL REFERENCES series(id), date TEXT NOT NULL, value REAL NOT NULL,
        PRIMARY KEY (series_id, date)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS collect_run (
        id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT,
        ok INTEGER NOT NULL DEFAULT 0, observations INTEGER NOT NULL DEFAULT 0, message TEXT);
      CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    // colonne ajoutée après la première base : migration sans perte
    const cols = (this.db.prepare("PRAGMA table_info(series)").all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes("description")) this.db.exec("ALTER TABLE series ADD COLUMN description TEXT");
  }

  putSetting(key: string, value: unknown): void {
    this.db.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(key, JSON.stringify(value));
  }

  /** Réglage, ou null s'il n'existe pas encore (base neuve). */
  settingOrNull(key: string): unknown {
    const row = this.db.prepare("SELECT value FROM setting WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  setting(key: string): unknown {
    const row = this.db.prepare("SELECT value FROM setting WHERE key = ?").get(key) as { value: string } | undefined;
    if (!row) throw new Error(`réglage absent de la base : ${key} (collecte jamais lancée ?)`);
    return JSON.parse(row.value);
  }

  series(id: string): SeriesDecl | null {
    const r = this.db.prepare(`SELECT id, label, unit, frequency, source_id AS sourceId, derived_from AS derivedFrom, description
      FROM series WHERE id = ?`).get(id) as Record<string, string | null> | undefined;
    if (!r || !r.unit || !isUnit(r.unit) || !r.frequency || !isFrequency(r.frequency)) return null;
    return { id: r.id!, label: r.label!, unit: r.unit, frequency: r.frequency, sourceId: r.sourceId!,
      ...(r.derivedFrom ? { derivedFrom: JSON.parse(r.derivedFrom) as string[] } : {}),
      ...(r.description ? { description: r.description } : {}) };
  }

  source(id: string): SourceDecl | null {
    const r = this.db.prepare("SELECT id, name, publisher, url, licence, vault_entry AS vaultEntry FROM source WHERE id = ?")
      .get(id) as (SourceDecl & { vaultEntry: string | null }) | undefined;
    if (!r) return null;
    const { vaultEntry, ...rest } = r;
    return vaultEntry ? { ...rest, vaultEntry } : rest;
  }

  upsertSource(s: SourceDecl): void {
    this.db.prepare(`INSERT INTO source (id, name, publisher, url, licence, vault_entry)
      VALUES (@id, @name, @publisher, @url, @licence, @vaultEntry)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, publisher=excluded.publisher, url=excluded.url,
        licence=excluded.licence, vault_entry=excluded.vault_entry`).run({ ...s, vaultEntry: s.vaultEntry ?? null });
  }

  upsertSeries(s: SeriesDecl): void {
    this.db.prepare(`INSERT INTO series (id, label, unit, frequency, source_id, derived_from, description)
      VALUES (@id, @label, @unit, @frequency, @sourceId, @derivedFrom, @description)
      ON CONFLICT(id) DO UPDATE SET label=excluded.label, unit=excluded.unit, frequency=excluded.frequency,
        source_id=excluded.source_id, derived_from=excluded.derived_from, description=excluded.description`)
      .run({ ...s, derivedFrom: s.derivedFrom ? JSON.stringify(s.derivedFrom) : null, description: s.description ?? null });
  }

  /** Remplace les valeurs existantes : une source peut corriger une donnée publiée. */
  putObservations(obs: readonly Observation[]): void {
    const put = this.db.prepare(`INSERT INTO observation (series_id, date, value) VALUES (?, ?, ?)
      ON CONFLICT(series_id, date) DO UPDATE SET value=excluded.value`);
    for (const o of obs) put.run(o.seriesId, o.date, o.value);
  }

  get(seriesId: string): Observation[] {
    return this.db.prepare(`SELECT series_id AS seriesId, date, value FROM observation
      WHERE series_id = ? ORDER BY date`).all(seriesId) as Observation[];
  }

  ids(prefix: string): string[] {
    return (this.db.prepare(`SELECT id FROM series WHERE id LIKE ? ORDER BY id`)
      .all(prefix.replace(/[%_]/g, (c) => "\\" + c) + "%") as { id: string }[]).map((r) => r.id);
  }

  close(): void { this.db.close(); }
}

// Base SQLite : sources, séries, observations, et le journal des collectes.
import Database from "better-sqlite3";
import type { Observation, SeriesDecl, SeriesReader, SourceDecl } from "./contract.js";

export class Store implements SeriesReader {
  readonly db: Database.Database;

  constructor(path: string) {
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
    `);
  }

  upsertSource(s: SourceDecl): void {
    this.db.prepare(`INSERT INTO source (id, name, publisher, url, licence, vault_entry)
      VALUES (@id, @name, @publisher, @url, @licence, @vaultEntry)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, publisher=excluded.publisher, url=excluded.url,
        licence=excluded.licence, vault_entry=excluded.vault_entry`).run({ ...s, vaultEntry: s.vaultEntry ?? null });
  }

  upsertSeries(s: SeriesDecl): void {
    this.db.prepare(`INSERT INTO series (id, label, unit, frequency, source_id, derived_from)
      VALUES (@id, @label, @unit, @frequency, @sourceId, @derivedFrom)
      ON CONFLICT(id) DO UPDATE SET label=excluded.label, unit=excluded.unit, frequency=excluded.frequency,
        source_id=excluded.source_id, derived_from=excluded.derived_from`)
      .run({ ...s, derivedFrom: s.derivedFrom ? JSON.stringify(s.derivedFrom) : null });
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

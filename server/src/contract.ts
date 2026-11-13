// Contrat des greffons de données. Même principe qu'OpenCloudApp : un greffon n'importe pas le cœur,
// il reçoit une `PluginApi` et y déclare ce qu'il apporte (sources, séries, collecteurs, dérivations).

/** Unités affichées. Énumérées : le code s'y réfère par leur nom, jamais par une chaîne écrite à la main. */
export const UNIT = {
  eurPerLitre: "EUR/L",
  eurPerKwh: "EUR/kWh",
  eurPerYear: "EUR/an",
  usdPerBarrel: "USD/bbl",
  usdPerEur: "USD/EUR",
  percent: "%",
} as const;
export type Unit = (typeof UNIT)[keyof typeof UNIT];

/** Rythme de publication d'une série. `onChange` : une valeur par changement (tarif, taux de taxe). */
export const FREQUENCY = {
  daily: "daily",
  weekly: "weekly",
  semiannual: "semiannual",
  onChange: "onChange",
} as const;
export type Frequency = (typeof FREQUENCY)[keyof typeof FREQUENCY];

/** D'où vient une donnée. Tout chiffre affiché remonte à une source déclarée ici, avec son lien. */
export type SourceDecl = {
  id: string;
  name: string;
  publisher: string;
  url: string;
  licence: string;
  /** Entrée du coffre qui porte la clé, si la source en demande une (gratuite). Jamais la clé elle-même. */
  vaultEntry?: string;
};

export type SeriesDecl = {
  id: string;
  label: string;
  unit: Unit;
  frequency: Frequency;
  sourceId: string;
  /** Séries dont celle-ci est calculée. Vide : relevée telle quelle à la source. */
  derivedFrom?: readonly string[];
};

/** Une valeur datée. `date` au format AAAA-MM-JJ. */
export type Observation = { seriesId: string; date: string; value: number };

/** Ce qu'un collecteur reçoit : de quoi télécharger, sans savoir comment le cœur stocke. */
export type CollectContext = {
  fetchBytes: (url: string) => Promise<Uint8Array>;
  fetchText: (url: string) => Promise<string>;
};

export type Collector = {
  id: string;
  run: (ctx: CollectContext) => Promise<Observation[]>;
};

/** Lecture des séries déjà en base, pour les dérivations. */
export type SeriesReader = {
  get: (seriesId: string) => Observation[];
  ids: (prefix: string) => string[];
};

/** Une dérivation calcule des séries à partir d'autres (ex. part des taxes = TTC - HT). Elle tourne
 *  après tous les collecteurs, dans l'ordre de déclaration. */
export type Derivation = {
  id: string;
  run: (read: SeriesReader) => Observation[];
};

export type PluginApi = {
  declareSource: (s: SourceDecl) => void;
  declareSeries: (s: SeriesDecl) => void;
  registerCollector: (c: Collector) => void;
  registerDerivation: (d: Derivation) => void;
};

export type Plugin = {
  id: string;
  title: string;
  register: (api: PluginApi) => void;
};

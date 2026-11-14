// Contrat des plugins de Winnza. Le format d'un plugin et son chargement viennent d'OpenPluginHost,
// le moteur partagé avec OpenCloudApp ; un plugin n'importe pas le cœur, il reçoit une `PluginApi` et
// y déclare ce qu'il apporte (sources, séries, réglages, collecteurs, dérivations).
import type { Plugin as HostPlugin } from "@isno-open/plugin-host";

/** Unités affichées. Énumérées : le code s'y réfère par leur nom, jamais par une chaîne écrite à la main. */
export const UNIT = {
  eurPerLitre: "EUR/L",
  eurPerKwh: "EUR/kWh",
  eurPerYear: "EUR/an",
  usdPerBarrel: "USD/bbl",
  usdPerGallon: "USD/gal",
  usdPerEur: "USD/EUR",
  percent: "%",
  /** nombre de stations (ex. stations qui affichent un carburant) */
  stations: "stations",
  /** code de couleur d'un jour Tempo, tel que la source le donne (sa signification est déclarée) */
  tempoCode: "code Tempo",
} as const;
export type Unit = (typeof UNIT)[keyof typeof UNIT];

/** Rythme de publication d'une série. `onChange` : une valeur par changement (tarif, taux de taxe). */
export const FREQUENCY = {
  daily: "daily",
  weekly: "weekly",
  semiannual: "semiannual",
  annual: "annual",
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
  /** Explication grand public de ce que mesure la série (affichée telle quelle). */
  description?: string;
};

/** Un réglage écrit en base par un plugin (identité du site, choix éditoriaux d'une page, catalogue).
 *  Le site ne lit QUE la base : ce qu'il affiche y est entré par un plugin. */
export type SettingDecl = { key: string; value: unknown };

/** Une valeur datée. `date` au format AAAA-MM-JJ. */
export type Observation = { seriesId: string; date: string; value: number };

/** Ce qu'un collecteur reçoit : de quoi télécharger, sans savoir comment le cœur stocke. */
export type CollectContext = {
  fetchBytes: (url: string) => Promise<Uint8Array>;
  fetchText: (url: string) => Promise<string>;
  /** requête POST (API qui demandent un corps, ex. Google Ads) ; jamais mise en cache */
  postText: (url: string, body: string, headers: Record<string, string>) => Promise<string>;
  /** un secret du serveur (variable d'environnement), ou null s'il n'est pas défini. Jamais en base, jamais
   *  dans le dépôt ; le plugin déclare le NOM de la variable dans ses réglages, pas sa valeur. */
  secret: (name: string) => string | null;
};

export type Collector = {
  id: string;
  run: (ctx: CollectContext) => Promise<Observation[]>;
} & (
  | { optional?: false }
  /** source d'appoint (ex. prix de gros) : si elle ne répond pas, la collecte continue, l'échec est signalé et
   *  les dernières valeurs en base restent. Elle nomme les séries qu'elle produit : en cas d'échec, seules les
   *  ancres de ces séries sont mises de côté ; en cas de succès, elle ne peut rien écrire d'autre. */
  | { optional: true; produces: readonly string[] }
);

/** Instantané daté : l'état d'un ensemble d'éléments un jour donné (ex. chaque station, sa position et ses
 *  prix). Pour ce qui n'est pas une série de nombres. Le cœur garde `keepDays` jours, puis efface. */
export type SnapshotDecl = {
  id: string; label: string; sourceId: string; keepDays: number;
  /** source d'appoint (ex. noms des stations) : si elle ne répond pas, la collecte continue et garde le
   *  dernier instantané valable, au lieu d'échouer ; l'échec est signalé dans le compte rendu */
  optional?: boolean;
};
export type SnapshotItem = { key: string; value: unknown };
export type Snapshot = { date: string; items: SnapshotItem[] };
export type SnapshotCollector = {
  id: string;
  snapshot: string;
  /** `read` : la base telle qu'elle était AVANT cette collecte (les relevés du jour n'y sont pas encore) */
  run: (ctx: CollectContext, read: CollectReader) => Promise<Snapshot>;
};
export type SnapshotReader = {
  /** jours disponibles, du plus ancien au plus récent */
  snapshotDates: (id: string) => string[];
  snapshot: (id: string, date: string) => SnapshotItem[];
};

/** Ce qu'un collecteur d'instantané peut lire de la base (relevés des collectes précédentes). */
export type CollectReader = SeriesReader & SnapshotReader & { settingOrNull: (key: string) => unknown };

/** Lecture des séries déjà en base, pour les dérivations. */
export type SeriesReader = {
  get: (seriesId: string) => Observation[];
  ids: (prefix: string) => string[];
};

/** Tout ce que les pages lisent : séries, leur description, leurs sources, les réglages. */
export type SiteReader = SeriesReader & SnapshotReader & {
  series: (id: string) => SeriesDecl | null;
  source: (id: string) => SourceDecl | null;
  setting: (key: string) => unknown;
  /** réglage, ou null s'il n'existe pas (plugin jamais chargé ou éteint) */
  settingOrNull: (key: string) => unknown;
};

/** Une dérivation calcule des séries à partir d'autres (ex. part des taxes = TTC - HT). Elle tourne
 *  après tous les collecteurs, dans l'ordre de déclaration. */
export type Derivation = {
  id: string;
  /** lit les séries et les instantanés déjà en base (ceux du jour compris) */
  run: (read: SeriesReader & SnapshotReader) => Observation[];
};

/** Ce que Winnza donne à un plugin. Le moteur (OpenPluginHost) ne connaît cette api que par son type :
 *  c'est la partie propre à Winnza, le reste du contrat est partagé avec OpenCloudApp. */
export type PluginApi = {
  declareSource: (s: SourceDecl) => void;
  declareSeries: (s: SeriesDecl) => void;
  declareSetting: (s: SettingDecl) => void;
  registerCollector: (c: Collector) => void;
  registerDerivation: (d: Derivation) => void;
  declareSnapshot: (s: SnapshotDecl) => void;
  registerSnapshotCollector: (c: SnapshotCollector) => void;
  /** les réglages du plugin, tels qu'enregistrés en base */
  settings: () => unknown;
};

/** Catégories de plugins reconnues par Winnza (écran d'administration). */
export const PLUGIN_CATEGORY = { data: "data", site: "site", other: "other" } as const;
export type PluginCategory = (typeof PLUGIN_CATEGORY)[keyof typeof PLUGIN_CATEGORY];
export const PLUGIN_CATEGORIES: readonly PluginCategory[] = Object.values(PLUGIN_CATEGORY);

export type Plugin = HostPlugin<PluginApi, PluginCategory>;

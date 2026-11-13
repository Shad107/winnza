// Les quatre parts d'un litre : nom affiché, couleur, icône, explication. Déclarées une fois, lues par
// tous les composants (barre, cartes, bidon, colonnes, légendes).
import { LITRE_PART, LITRE_PARTS, type LitrePart } from '@winnza/core/pages/fuel-page.js';

export { LITRE_PART, LITRE_PARTS, type LitrePart };

export const ICON = { drop: 'drop', refinery: 'refinery', state: 'state', percent: 'percent', chart: 'chart', spark: 'spark' } as const;
export type IconName = (typeof ICON)[keyof typeof ICON];

export type PartMeta = { label: string; short: string; color: string; ink: string; icon: IconName; description: string };

export const PART_META = {
  [LITRE_PART.oil]: { label: 'Le pétrole', short: 'Pétrole', color: 'var(--s1)', ink: 'var(--on-s1)', icon: ICON.drop,
    description: 'Le prix du baril, converti en euros. Le seul poste qui suit le marché mondial.' },
  [LITRE_PART.refine]: { label: 'La raffinerie et la station', short: 'Raffinerie et station', color: 'var(--s2)', ink: 'var(--on-s2)', icon: ICON.refinery,
    description: 'Transformer le brut en carburant, le transporter, le stocker, puis le vendre.' },
  [LITRE_PART.excise]: { label: 'La TICPE', short: 'TICPE', color: 'var(--s3)', ink: 'var(--on-s3)', icon: ICON.state,
    description: "Taxe fixe sur chaque litre, votée par l'État. Son nom officiel : accise sur les énergies." },
  [LITRE_PART.vat]: { label: 'La TVA', short: 'TVA', color: 'var(--s4)', ink: 'var(--on-s4)', icon: ICON.percent,
    description: "Calculée sur tout le reste, TICPE comprise : c'est une taxe sur une taxe." },
} satisfies Record<LitrePart, PartMeta>;

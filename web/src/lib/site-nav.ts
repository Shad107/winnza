// Les pages du site, déclarées une fois : le menu de l'en-tête et les cartes « Pour aller plus loin »
// les lisent toutes deux. Une rubrique sans `href` est annoncée (« bientôt ») sans être un lien mort.
export type Section = { href?: string; label: string; title: string; text: string };

export const SECTIONS: readonly Section[] = [
  { href: '/', label: 'Le plein', title: 'Où passe l\'argent de votre plein', text: 'Le litre ou le plein découpé en quatre parts, et le prix du jour de chaque carburant.' },
  { href: '/taxes', label: 'Taxes', title: 'Les taxes sur le carburant', text: 'TICPE, TVA, et les charges imposées qu\'on ne voit jamais sur le ticket.' },
  { href: '/historique', label: 'Depuis 2005', title: 'Le prix du litre depuis 2005', text: 'Année par année, et ce qui a vraiment changé depuis le record du baril de 2008.' },
  { href: '/prix-du-baril', label: 'Prix du baril', title: 'Le prix du baril et la pompe', text: 'Pourquoi le baril ne fait pas le prix à la pompe, et le rôle du dollar.' },
  { href: '/prevision', label: 'Prévision', title: 'Le carburant va-t-il baisser ?', text: 'Hausse ou baisse la semaine qui vient, d\'après le marché de gros, avec le bilan réel de la méthode.' },
  { href: '/europe', label: 'Europe', title: 'Moins cher chez nos voisins ?', text: 'Le même plein en Espagne, au Luxembourg, en Belgique, en Allemagne...' },
  { label: 'Électricité', title: 'Électricité', text: '' },
];

export const PAGES = SECTIONS.filter((s): s is Section & { href: string } => !!s.href);

// Les pages du site, déclarées une fois : le menu de l'en-tête et les cartes « Pour aller plus loin »
// les lisent toutes deux. Une rubrique sans `href` est annoncée (« bientôt ») sans être un lien mort.
export type Section = { href?: string; label: string; title: string; text: string };

export const SECTIONS: readonly Section[] = [
  { href: '/', label: 'Le plein', title: 'Où passe l\'argent de votre plein', text: 'Le litre ou le plein découpé en quatre parts, et le prix du jour de chaque carburant.' },
  { href: '/taxes', label: 'Taxes', title: 'Les taxes sur le carburant', text: 'TICPE, TVA, et les charges imposées qu\'on ne voit jamais sur le ticket.' },
  { href: '/historique', label: 'Depuis 2005', title: 'Le prix du litre depuis 2005', text: 'Année par année, et ce qui a vraiment changé depuis le record du baril de 2008.' },
  { href: '/prix-du-baril', label: 'Prix du baril', title: 'Le prix du baril et la pompe', text: 'Pourquoi le baril ne fait pas le prix à la pompe, et le rôle du dollar.' },
  { href: '/carte-des-stations', label: 'Carte', title: 'Le prix près de chez vous', text: 'Chaque station de France sur une carte, avec son prix du jour et sa variation sur 7 jours.' },
  { href: '/prix-carburant', label: 'Villes', title: 'Le prix dans votre ville', text: 'Le prix du jour de chaque carburant dans chaque ville qui a une station, et la station la moins chère.' },
  { href: '/prix-par-departement', label: 'Départements', title: 'Le prix dans votre département', text: 'La carte de France du prix du jour, les départements les moins chers et les plus chers.' },
  { href: '/prevision', label: 'Prévision', title: 'Le carburant va-t-il baisser ?', text: 'Hausse ou baisse la semaine qui vient, d\'après le marché de gros, avec le bilan réel de la méthode.' },
  { href: '/analyses', label: 'Analyses', title: 'Ce qui a bougé', text: 'Quand un prix bouge vraiment : record, hausse nette, taxe ou tarif qui change, avec nos chiffres.' },
  { href: '/europe', label: 'Europe', title: 'Moins cher chez nos voisins ?', text: 'Le même plein en Espagne, au Luxembourg, en Belgique, en Allemagne...' },
  { href: '/cout-aux-100-km', label: '100 km', title: 'Combien coûtent 100 km ?', text: 'Diesel, essence, E85, GPL, électrique à la maison ou sur borne : le coût de 100 km au prix du jour.' },
  { href: '/electricite', label: 'Électricité', title: 'Le vrai prix du kWh', text: 'Le kWh découpé en énergie, réseau, taxes et TVA, le tarif réglementé depuis 2012, Tempo et nos voisins européens.' },
];

export const PAGES = SECTIONS.filter((s): s is Section & { href: string } => !!s.href);

// Les réseaux où partager un mème : de simples liens vers la page de partage de chaque réseau. Aucun script
// de réseau social n'est chargé, aucun pistage. L'aperçu (image, titre) vient des balises Open Graph de la
// page (plugin seo, image /partage/<sujet>.png). Un réseau sans lien de partage web (Instagram, TikTok) passe
// par « Télécharger l'image ».
export const NETWORK = {
  whatsapp: 'whatsapp', facebook: 'facebook', x: 'x', bluesky: 'bluesky', linkedin: 'linkedin', reddit: 'reddit', telegram: 'telegram',
} as const;
export type Network = (typeof NETWORK)[keyof typeof NETWORK];

const e = encodeURIComponent;
/** Le nom affiché et l'adresse de partage de chaque réseau, pour un lien et un texte donnés. */
export const NETWORKS = {
  [NETWORK.whatsapp]: { label: 'WhatsApp', href: (url: string, text: string) => `https://wa.me/?text=${e(`${text} ${url}`)}` },
  [NETWORK.facebook]: { label: 'Facebook', href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
  [NETWORK.x]: { label: 'X', href: (url: string, text: string) => `https://x.com/intent/post?text=${e(text)}&url=${e(url)}` },
  [NETWORK.bluesky]: { label: 'Bluesky', href: (url: string, text: string) => `https://bsky.app/intent/compose?text=${e(`${text} ${url}`)}` },
  [NETWORK.linkedin]: { label: 'LinkedIn', href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}` },
  [NETWORK.reddit]: { label: 'Reddit', href: (url: string, text: string) => `https://www.reddit.com/submit?url=${e(url)}&title=${e(text)}` },
  [NETWORK.telegram]: { label: 'Telegram', href: (url: string, text: string) => `https://t.me/share/url?url=${e(url)}&text=${e(text)}` },
} satisfies Record<Network, { label: string; href: (url: string, text: string) => string }>;

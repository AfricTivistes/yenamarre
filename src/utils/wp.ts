import { getCollection } from 'astro:content';

export type Acf = Record<string, any>;

/**
 * Valeurs ACF d'une page WordPress (collection `pages` chargée au build par dewp).
 * Renvoie {} si la page n'existe pas ou n'a aucune valeur
 * (WordPress renvoie [] quand aucun champ n'est enregistré).
 */
export async function getPageAcf(slug: string): Promise<Acf> {
  const pages = await getCollection('pages', (page) => page.data.slug === slug);
  const raw = pages[0]?.data.acf;
  return raw && !Array.isArray(raw) && typeof raw === 'object' ? raw : {};
}

/**
 * Réglages globaux du site : champs ACF de la page WordPress
 * « Réglages du site » (slug `reglages-du-site`).
 */
export function getSiteSettings(): Promise<Acf> {
  return getPageAcf('reglages-du-site');
}

/** Valeur WordPress non vide, sinon repli sur `fallback`. */
export function field(acf: Acf, key: string, fallback: string): string {
  const v = acf[key];
  return v != null && String(v).trim() !== '' ? String(v) : fallback;
}

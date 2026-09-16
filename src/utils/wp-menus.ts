import { getCollection } from 'astro:content';
import { load } from 'cheerio';
import { getProjets } from './wp-contenus';

// Menus gérés dans WordPress : Apparence › Éditeur › Navigation.
// Chaque menu est retrouvé par son identifiant (slug). S'il est introuvable
// ou vide, on utilise le menu par défaut ci-dessous (menus d'origine du site).

export interface MenuItem {
  label: string;
  url: string;
  externe: boolean;
  image?: string;
  enfants: MenuItem[];
}

const WP_BASE = 'https://yem.yenamarre.sn/yenamarre';

const lien = (label: string, url: string, enfants: MenuItem[] = []): MenuItem => ({
  label,
  url,
  externe: url.startsWith('http'),
  enfants,
});

export const MENUS_PAR_DEFAUT: Record<string, MenuItem[]> = {
  'menu-principal': [
    lien('Accueil', '/'),
    lien('À propos', '/yenamarre'),
    lien('Projets', '/projets', [
      lien('Dox ak Sa Gox', '/dox-ak-sa-gox'),
      lien('La Télé Citoyenne (LTC)', 'https://ltc.yenamarre.sn/'),
      lien('Citizen Mic', 'https://citizenmic.yenamarre.sn/'),
      lien('Karibu', 'https://karibu.yenamarre.sn/'),
    ]),
    lien('Actualités', '/actualites', [
      lien('Toutes les actualités', '/actualites'),
      lien('Communiqués de presse', '/actualites/categories/communique-de-presse'),
      lien('YEM dans la presse', '/actualites/categories/yem-dans-la-presse'),
      lien('Tribune libre', '/actualites/categories/tribune-libre'),
      lien('Dox Ak Sa Gox', '/actualites/categories/dox-ak-sa-gox'),
    ]),
    lien('Contact', '/contact'),
  ],
  'footer-liens-rapides': [
    lien('Accueil', '/'),
    lien('À propos', '/yenamarre'),
    lien('Actualités', '/actualites'),
    lien('Contact', '/contact'),
    lien('Rejoignez-nous', '/rejoindre'),
  ],
  'footer-nos-projets': [
    lien("Y'EN A MARRE", '/yenamarre'),
    lien('La Télé Citoyenne', 'https://ltc.yenamarre.sn/'),
    lien('Karibu', 'https://karibu.yenamarre.sn/'),
    lien('Dox Ak Sa Gox', '/dox-ak-sa-gox'),
    lien('Citizen Mic', 'https://citizenmic.yenamarre.sn/'),
  ],
  'footer-liens-legaux': [
    lien('Mentions légales', '/mentions-legales'),
    lien('Politique de confidentialité', '/politique-de-confidentialite'),
  ],
};

// Lien vers une page du site WordPress → chemin relatif du site Astro.
const normaliserUrl = (url: string): string => {
  if (url.startsWith(WP_BASE)) return url.slice(WP_BASE.length) || '/';
  return url || '#';
};

// Clé de comparaison d'URL (sans protocole, www ni slash final).
const cleUrl = (url: string): string =>
  url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();

function analyser(html: string): MenuItem[] {
  const $ = load(`<ul id="racine">${html}</ul>`);
  const lire = (li: any): MenuItem => {
    const a = $(li).children('a, button').first();
    const url = normaliserUrl(a.attr('href') ?? '');
    return {
      label: $(li).find('.wp-block-navigation-item__label').first().text().trim() || a.text().trim(),
      url,
      externe: a.attr('target') === '_blank' || url.startsWith('http'),
      enfants: $(li)
        .children('ul')
        .children('li')
        .toArray()
        .map(lire),
    };
  };
  return $('#racine').children('li').toArray().map(lire).filter((item) => item.label);
}

/** Menu WordPress (par slug), sinon menu par défaut. Vignettes = logos des Projets. */
export async function getMenu(slug: string): Promise<MenuItem[]> {
  const navigations = await getCollection('navigations');
  const nav: any = navigations.find(({ data }: any) => data.slug === slug)?.data;
  const items = nav?.content?.rendered ? analyser(nav.content.rendered) : [];
  const menu = items.length > 0 ? items : MENUS_PAR_DEFAUT[slug] ?? [];

  // Vignette d'un lien = logo du projet WordPress pointant vers la même URL.
  const logos = new Map((await getProjets()).map((p) => [cleUrl(p.url), p.logo]));
  const avecImages = (liste: MenuItem[]): MenuItem[] =>
    liste.map((item) => ({
      ...item,
      image: logos.get(cleUrl(item.url)),
      enfants: avecImages(item.enfants),
    }));
  return avecImages(menu);
}

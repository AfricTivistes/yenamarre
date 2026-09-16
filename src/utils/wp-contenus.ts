import { getCollection } from 'astro:content';
import he from 'he';
import { getProjects, type Project } from './cms';
import { featureIcon } from './icons';
import bureauxJson from '../data/bureaux.json';

// Contenus « listes » gérés dans WordPress (types de contenu Projets, Membres,
// Bureaux, FAQ). Si WordPress ne renvoie rien, on retombe sur les sources
// existantes (Decap CMS, fichiers JSON, textes codés en dur).

type Entree = { title: string; content: string; acf: Record<string, any> };

async function lireType(collection: 'projets' | 'membres' | 'bureaux' | 'faqs'): Promise<Entree[]> {
  const entrees = await getCollection(collection);
  return entrees
    .map(({ data }: any) => ({
      title: he.decode(data.title?.rendered ?? ''),
      content: data.content?.rendered ?? '',
      acf: data.acf && !Array.isArray(data.acf) ? data.acf : {},
    }))
    .sort((a, b) => Number(a.acf.ordre ?? 10) - Number(b.acf.ordre ?? 10));
}

const texte = (v: unknown): string => (v == null ? '' : String(v).trim());

// Couleurs de carte : mêmes classes que la palette de src/utils/cms.ts.
const COULEURS_CARTE: Record<string, Pick<Project, 'bgGradient' | 'buttonColor' | 'buttonHoverColor'>> = {
  vert: { bgGradient: 'bg-gradient-to-br from-green-600 to-green-800', buttonColor: 'bg-green-600', buttonHoverColor: 'hover:bg-green-700' },
  noir: { bgGradient: 'bg-gradient-to-br from-gray-900 to-black', buttonColor: 'bg-black', buttonHoverColor: 'hover:bg-gray-800' },
  gris: { bgGradient: 'bg-gradient-to-br from-gray-700 to-gray-900', buttonColor: 'bg-gray-800', buttonHoverColor: 'hover:bg-gray-700' },
  karibu: { bgGradient: 'bg-gradient-to-br from-karibu-green to-green-700', buttonColor: 'bg-karibu-green', buttonHoverColor: 'hover:bg-green-700' },
  rouge: { bgGradient: 'bg-gradient-to-br from-yam-red to-red-700', buttonColor: 'bg-yam-red', buttonHoverColor: 'hover:bg-red-700' },
  bleu: { bgGradient: 'bg-gradient-to-br from-blue-600 to-blue-800', buttonColor: 'bg-blue-600', buttonHoverColor: 'hover:bg-blue-700' },
  violet: { bgGradient: 'bg-gradient-to-br from-purple-600 to-purple-800', buttonColor: 'bg-purple-600', buttonHoverColor: 'hover:bg-purple-700' },
  orange: { bgGradient: 'bg-gradient-to-br from-orange-600 to-orange-800', buttonColor: 'bg-orange-600', buttonHoverColor: 'hover:bg-orange-700' },
};

const COULEURS_ICONES: Record<string, string> = {
  vert: 'text-green-600',
  noir: 'text-black',
  gris: 'text-gray-700',
  karibu: 'text-karibu-green',
  rouge: 'text-yam-red',
  bleu: 'text-blue-600',
  violet: 'text-purple-600',
  orange: 'text-orange-600',
};

/** Projets (WordPress), sinon projets Decap CMS. */
export async function getProjets(): Promise<Project[]> {
  const entrees = await lireType('projets');
  if (entrees.length === 0) return getProjects();

  return entrees.map(({ title, acf }) => {
    const couleurIcones = COULEURS_ICONES[acf.couleur_icones] ?? COULEURS_ICONES.vert;
    return {
      title,
      description: texte(acf.description),
      logo: texte(acf.logo_image) || texte(acf.logo_url) || '/images/yem.webp',
      url: texte(acf.lien) || '#',
      features: [1, 2, 3]
        .map((n) => ({ texte: texte(acf[`atout${n}_texte`]), icone: texte(acf[`atout${n}_icone`]) }))
        .filter((atout) => atout.texte)
        .map((atout) => ({ icon: featureIcon(atout.icone, couleurIcones), text: atout.texte })),
      ...(COULEURS_CARTE[acf.couleur] ?? COULEURS_CARTE.vert),
    };
  });
}

export interface Membre {
  name: string;
  role: string;
  description?: string;
  image: string;
}

/** Membres d'un groupe (WordPress), sinon `fallback`. */
export async function getMembres(groupe: string, fallback: Membre[]): Promise<Membre[]> {
  const membres = (await lireType('membres'))
    .filter(({ acf }) => (texte(acf.groupe) || 'fondateur') === groupe)
    .map(({ title, acf }) => ({
      name: title,
      role: texte(acf.role),
      description: texte(acf.description) || undefined,
      image: texte(acf.photo_image) || texte(acf.photo_url) || '/images/yem.webp',
    }));
  return membres.length > 0 ? membres : fallback;
}

export interface Bureau {
  id: number;
  localite: string;
  region: string;
  lat: number;
  lng: number;
  address: string;
  coordinators: { nom: string; phone: string }[];
  formers: { nom: string; phone: string }[];
}

// « Nom | Téléphone », une personne par ligne.
const personnes = (v: unknown) =>
  texte(v)
    .split(/\r?\n/)
    .map((ligne) => ligne.split('|').map((s) => s.trim()))
    .filter(([nom]) => nom)
    .map(([nom, phone = '']) => ({ nom, phone }));

/** Bureaux (WordPress), sinon src/data/bureaux.json. */
export async function getBureaux(): Promise<Bureau[]> {
  const entrees = await lireType('bureaux');
  if (entrees.length === 0) return bureauxJson as Bureau[];

  return entrees
    .map(({ title, acf }, index) => ({
      id: index + 1,
      localite: title,
      region: texte(acf.region),
      lat: Number(acf.latitude),
      lng: Number(acf.longitude),
      address: texte(acf.adresse),
      coordinators: personnes(acf.coordinateurs),
      formers: personnes(acf.formateurs),
    }))
    .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0));
}

export interface Faq {
  question: string;
  reponse: string;
}

/** Questions fréquentes (WordPress), sinon `fallback`. Réponse en texte brut. */
export async function getFaqs(fallback: Faq[]): Promise<Faq[]> {
  const faqs = (await lireType('faqs')).map(({ title, content }) => ({
    question: title,
    reponse: he.decode(content.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
  }));
  return faqs.length > 0 ? faqs : fallback;
}

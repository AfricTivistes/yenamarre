import { getPageAcf, field } from './wp';

// Chiffres d'impact : une seule source, la page WordPress « Historique »
// (champs stat1..4_nombre / _label / _description), repris aussi par l'accueil.

export interface Chiffre {
  number: string;
  label: string;
  description: string;
}

const PAR_DEFAUT: Chiffre[] = [
  { number: '12', label: "Années d'activisme", description: "Plus d'une décennie d'engagement" },
  { number: '100000', label: 'Citoyens mobilisés', description: 'À travers tout le Sénégal' },
  { number: '50', label: 'Campagnes menées', description: 'Pour la démocratie et la bonne gouvernance' },
  { number: '14', label: 'Régions touchées', description: 'Présence sur tout le territoire national' },
];

export async function getChiffresImpact(): Promise<Chiffre[]> {
  const acf = await getPageAcf('historique');
  return PAR_DEFAUT.map((defaut, i) => ({
    number: field(acf, `stat${i + 1}_nombre`, defaut.number),
    label: field(acf, `stat${i + 1}_label`, defaut.label),
    description: field(acf, `stat${i + 1}_description`, defaut.description),
  }));
}

export interface ChiffreDecoupe {
  avant: string;
  nombre: number | null;
  apres: string;
  /** Texte final, tel qu'affiché une fois l'animation terminée. */
  affichage: string;
}

/**
 * Découpe un chiffre saisi dans WordPress : « Plus de 50 » → avant « Plus de »,
 * nombre 50. Espaces et points de milliers acceptés (« 100 000 », « 100.000 »).
 * Sans nombre, le texte est affiché tel quel (pas d'animation).
 */
export function parseStat(texte: string): ChiffreDecoupe {
  const brut = texte.trim();
  const m = brut.match(/\d{1,3}(?:[\s  .]\d{3})+|\d+/);
  if (!m || m.index === undefined) {
    return { avant: brut, nombre: null, apres: '', affichage: brut };
  }
  const nombre = parseInt(m[0].replace(/[\s  .]/g, ''), 10);
  const avant = brut.slice(0, m.index);
  const apres = brut.slice(m.index + m[0].length);
  return { avant, nombre, apres, affichage: `${avant}${nombre.toLocaleString('fr-FR')}${apres}` };
}

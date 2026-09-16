import { defineCollection, z } from "astro:content";
import { wpCollections } from "dewp/loaders";
import { wpTypeLoader } from "./../loaders/wp-type-loader";

const endpoint = "https://yem.yenamarre.sn/yenamarre/wp-json/";

const wp = wpCollections({ endpoint });

// Types de contenu créés dans WordPress (menus Projets, Membres, Bureaux, FAQ).
const wpType = (restBase: string) =>
  defineCollection({ loader: wpTypeLoader({ endpoint, restBase }) });

export const collections = {
  ...wp,
  // Le schéma dewp des pages supprime le champ `acf` : on l'ajoute pour
  // pouvoir lire les champs ACF des pages WordPress.
  pages: defineCollection({
    loader: (wp.pages as { loader: any }).loader,
    schema: (wp.pages.schema as z.AnyZodObject).extend({
      acf: z.any().optional(),
    }),
  }),
  projets: wpType("projet"),
  membres: wpType("membre"),
  bureaux: wpType("bureau"),
  faqs: wpType("faq"),
};

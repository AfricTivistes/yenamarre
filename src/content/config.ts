import { defineCollection, z } from "astro:content";
import { wpCollections } from "dewp/loaders";

const endpoint = "https://yem.yenamarre.sn/yenamarre/wp-json/";

const wp = wpCollections({ endpoint });

export const collections = {
  ...wp,
  // Le schéma dewp des pages supprime le champ `acf` : on l'ajoute pour
  // pouvoir lire les champs ACF des pages WordPress.
  pages: defineCollection({
    loader: wp.pages.loader,
    schema: (wp.pages.schema as z.AnyZodObject).extend({
      acf: z.any().optional(),
    }),
  }),
};

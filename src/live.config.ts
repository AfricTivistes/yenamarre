import { defineLiveCollection, z } from "astro:content";
import { wordpressLoader } from "./loaders/wordpress-loader";

const posts = defineLiveCollection({
  loader: wordpressLoader({
    endpoint: "https://yem.yenamarre.sn/yenamarre/wp-json",
  }),
  schema: z
    .object({
      id: z.number(),
      slug: z.string(),
      title: z.string(),
      content: z.string(),
      excerpt: z.string().optional(),
      date: z.string().transform((str) => new Date(str)),
      categories: z.array(z.string()).optional().default([]),
      category: z.string().optional().default("Y'EN A MARRE"),
      image: z
        .string()
        .optional()
        .default("https://placehold.co/800x600?text=Y+EN+MARRE"),
      sticky: z.boolean().optional().default(false),
    })
    .transform((data) => ({
      ...data,
      formattedDate: data.date.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    })),
});

export const collections = { posts };

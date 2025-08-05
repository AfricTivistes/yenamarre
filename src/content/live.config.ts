import { defineLiveCollection, z } from 'astro/content';
import { wordpressLoader } from './loaders/wordpress-loader';

const posts = defineLiveCollection({
  loader: wordpressLoader({
    endpoint: process.env.WORDPRESS_API_URL ,
  }),
  schema: z
    .object({
      id: z.number(),
      slug: z.string(),
      title: z.string(),
      content: z.string(),
      date: z.string().transform((str) => new Date(str)),
    })
    .transform((data) => ({
      ...data,
      formattedDate: data.date.toLocaleDateString(),
    })),
});

export const collections = { posts };
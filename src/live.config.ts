import { defineLiveCollection, z } from "astro/content";
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
      date: z.string().transform((str) => new Date(str)),
    })
    .transform((data) => ({
      ...data,
      formattedDate: data.date.toLocaleDateString(),
    })),
});
console.log(posts);
export const collections = { posts };

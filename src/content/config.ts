import { defineCollection, z } from "astro:content";
import { wpCollections } from "dewp/loaders";

// === Configuration WordPress ===
const WP_ENDPOINT = "https://yem.yenamarre.sn/yenamarre/wp-json/";

const wpCols = wpCollections({
  endpoint: WP_ENDPOINT,
});

// === Types partagés ===
export interface WordPressContent {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  date: string;
  type: string;
  status: string;
  featured_media?: number;
  categories?: number[];
  meta?: Record<string, any>;
  link: string;
}

export interface MediaItem {
  id: number;
  source_url: string;
  alt_text: string;
  media_details: {
    width: number;
    height: number;
  };
}

// === Collections locales (fichiers Markdown dans /src/content/) ===

const stats = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    page: z.enum(["index", "yenamarre", "projets", "dox-ak-sa-gox"]),
    color: z.string().default("yam-red"),
    stats: z.array(
      z.object({
        number: z.string(),
        label: z.string(),
        color: z.string().optional(),
      }),
    ),
  }),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    logo: z.string(),
    url: z.string(),
    features: z.array(
      z.object({
        icon: z.string(),
        text: z.string(),
      }),
    ),
  }),
});

const heroes = defineCollection({
  type: "content",
  schema: z.object({
    active: z.boolean().default(false),
    page: z.enum(["index", "projets", "yenamarre", "contact"]),
    title: z.string(),
    highlightedText: z.string(),
    description: z.string(),
    backgroundImage: z.string(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().optional(),
    showWaveDivider: z.boolean().default(true),
  }),
});

// === Export final : fusion des collections WP + locales ===
export const collections = {
  ...wpCols,
  stats,
  projects,
  heroes,
};

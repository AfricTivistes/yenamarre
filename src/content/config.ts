import { wpCollections } from "dewp/loaders";

export const collections = wpCollections({
  endpoint: "https://yem.yenamarre.sn/yenamarre/wp-json/",
});

const WP_BASE_URL = "https://yem.yenamarre.sn/yenamarre/wp-json/wp/v2";

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

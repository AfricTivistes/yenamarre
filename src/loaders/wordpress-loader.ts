import type { LiveLoader } from "astro/loaders";

interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  date: string;
  excerpt: string | undefined;
  category: string | undefined;
  image: string | undefined;
  sticky: boolean;
}

export function wordpressLoader(config: {
  endpoint: string;
}): LiveLoader<Post> {
  // Cache category names to avoid repeated fetches
  let categoryMap: Record<number, string> = {};

  async function fetchMediaUrl(mediaId: number, endpoint: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${endpoint}/wp/v2/media/${mediaId}`);
      if (!response.ok) return undefined;
      const media = await response.json();
      return media.source_url || undefined;
    } catch (error) {
      console.error(`Error fetching media ${mediaId}: ${error.message}`);
      return undefined;
    }
  }

  async function fetchCategories(): Promise<void> {
    try {
      const response = await fetch(`${config.endpoint}/wp/v2/categories`);
      if (!response.ok)
        throw new Error(`Failed to fetch categories: ${response.status}`);
      const categories = await response.json();
      categoryMap = categories.reduce(
        (map: Record<number, string>, cat: any) => {
          map[cat.id] = cat.name;
          return map;
        },
        {},
      );
    } catch (error) {
      console.error(`Error fetching categories: ${error.message}`);
    }
  }

  return {
    name: "wordpress-loader",
    loadCollection: async ({ filter }) => {
      try {
        // Fetch categories if not already cached
        if (Object.keys(categoryMap).length === 0) {
          await fetchCategories();
        }

        const url = new URL(`${config.endpoint}/wp/v2/posts`);
        if (filter?.category) {
          const categoryId = Object.keys(categoryMap).find(
            (id) => categoryMap[Number(id)] === filter.category,
          );
          if (categoryId) {
            url.searchParams.append("categories", categoryId);
          }
        }
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const posts = await response.json();
        return {
          entries: posts.map((post: any) => ({
            id: post.id.toString(),
            data: {
              id: post.id,
              slug: post.slug,
              title: post.title.rendered,
              content: post.content.rendered,
              excerpt:
                post.excerpt?.rendered?.replace(/<[^>]+>/g, "") || undefined,
              date: post.date,
              category: post.categories?.length
                ? categoryMap[post.categories[0]]
                : undefined,
              image: post.featured_media
                ? await fetchMediaUrl(post.featured_media, config.endpoint)
                : undefined,
              sticky: post.sticky || false,
            },
          })),
        };
      } catch (error) {
        return { error: new Error(`Failed to load posts: ${error.message}`) };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        // Fetch categories if not already cached
        if (Object.keys(categoryMap).length === 0) {
          await fetchCategories();
        }

        const url = new URL(
          `${config.endpoint}/wp/v2/posts/${filter.id || filter.slug}`,
        );
        const response = await fetch(url.toString());
        if (!response.ok) return { error: new Error("Post not found") };
        const post = await response.json();
        return {
          id: post.id.toString(),
          data: {
            id: post.id,
            slug: post.slug,
            title: post.title.rendered,
            content: post.content.rendered,
            excerpt:
              post.excerpt?.rendered?.replace(/<[^>]+>/g, "") || undefined,
            date: post.date,
            category: post.categories?.length
              ? categoryMap[post.categories[0]]
              : undefined,
            image: post.featured_media
              ? await fetchMediaUrl(post.featured_media, config.endpoint)
              : undefined,
            sticky: post.sticky || false,
          },
          rendered: { html: post.content.rendered },
        };
      } catch (error) {
        return { error: new Error(`Failed to load post: ${error.message}`) };
      }
    },
  };
}

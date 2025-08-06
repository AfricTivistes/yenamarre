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

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | undefined;
  count: number;
}

export function wordpressCategoryLoader(config: {
  endpoint: string;
}): LiveLoader<Category> {
  return {
    name: "wordpress-category-loader",
    loadCollection: async () => {
      try {
        const response = await fetch(`${config.endpoint}/wp/v2/categories`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const categories = await response.json();
        
        return {
          entries: categories.map((category: any) => ({
            id: category.id.toString(),
            data: {
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description || undefined,
              count: category.count,
            },
          })),
        };
      } catch (error) {
        return { error: new Error(`Failed to load categories: ${error.message}`) };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        const url = new URL(
          `${config.endpoint}/wp/v2/categories/${filter.id || filter.slug}`,
        );
        const response = await fetch(url.toString());
        if (!response.ok) return { error: new Error("Category not found") };
        const category = await response.json();
        
        return {
          id: category.id.toString(),
          data: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || undefined,
            count: category.count,
          },
        };
      } catch (error) {
        return { error: new Error(`Failed to load category: ${error.message}`) };
      }
    },
  };
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
        
        // Fetch all media URLs first
        const mediaPromises = posts.map((post: any) => 
          post.featured_media 
            ? fetchMediaUrl(post.featured_media, config.endpoint)
            : Promise.resolve(undefined)
        );
        const mediaUrls = await Promise.all(mediaPromises);
        
        return {
          entries: posts.map((post: any, index: number) => ({
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
              image: mediaUrls[index],
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

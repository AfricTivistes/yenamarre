// src/loaders/wordpress-loader.ts
import type { LiveLoader } from 'astro/loaders';

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

export function wordpressLoader(config: { endpoint: string }): LiveLoader<Post> {
  let categoryMap: Record<number, string> = {};

  async function fetchCategories(): Promise<void> {
    try {
      const response = await fetch(`${config.endpoint}/wp/v2/categories?per_page=100`);
      if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status}`);
      const categories = await response.json();
      categoryMap = categories.reduce((map: Record<number, string>, cat: any) => {
        map[cat.id] = cat.name;
        return map;
      }, {});
    } catch (error) {
      console.error(`Error fetching categories: ${error.message}`);
    }
  }

  return {
    name: 'wordpress-loader',
    loadCollection: async ({ filter }) => {
      try {
        if (Object.keys(categoryMap).length === 0) {
          await fetchCategories();
        }

        const posts: any[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
          const url = new URL(`${config.endpoint}/wp/v2/posts`);
          url.searchParams.append('per_page', perPage.toString());
          url.searchParams.append('page', page.toString());
          url.searchParams.append('_embed', 'wp:featuredmedia');
          if (filter?.category) {
            const categoryId = Object.keys(categoryMap).find(
              (id) => categoryMap[Number(id)] === filter.category
            );
            if (categoryId) {
              url.searchParams.append('categories', categoryId);
            }
          }

          const response = await fetch(url.toString());
          if (!response.ok) {
            if (response.status === 400 && page > 1) break;
            throw new Error(`HTTP error: ${response.status}`);
          }

          const pagePosts = await response.json();
          posts.push(...pagePosts);

          const totalPages = Number(response.headers.get('X-WP-TotalPages') || 1);
          if (page >= totalPages) break;
          page++;
        }

        return {
          entries: posts.map((post) => ({
            id: post.id.toString(),
            data: {
              id: post.id,
              slug: post.slug,
              title: post.title.rendered,
              content: post.content.rendered,
              excerpt: post.excerpt?.rendered?.replace(/<[^>]+>/g, '') || undefined,
              date: post.date,
              category: post.categories?.length ? categoryMap[post.categories[0]] : undefined,
              image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://via.placeholder.com/800x600',
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
        if (Object.keys(categoryMap).length === 0) {
          await fetchCategories();
        }

        const url = new URL(`${config.endpoint}/wp/v2/posts/${filter.id || filter.slug}`);
        url.searchParams.append('_embed', 'wp:featuredmedia');
        const response = await fetch(url.toString());
        if (!response.ok) return { error: new Error('Post not found') };
        const post = await response.json();
        return {
          id: post.id.toString(),
          data: {
            id: post.id,
            slug: post.slug,
            title: post.title.rendered,
            content: post.content.rendered,
            excerpt: post.excerpt?.rendered?.replace(/<[^>]+>/g, '') || undefined,
            date: post.date,
            category: post.categories?.length ? categoryMap[post.categories[0]] : undefined,
            image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'https://via.placeholder.com/800x600',
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

export function wordpressCategoryLoader(config: { endpoint: string }): LiveLoader<Category> {
  return {
    name: 'wordpress-category-loader',
    loadCollection: async () => {
      try {
        const categories: any[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
          const url = new URL(`${config.endpoint}/wp/v2/categories`);
          url.searchParams.append('per_page', perPage.toString());
          url.searchParams.append('page', page.toString());

          const response = await fetch(url.toString());
          if (!response.ok) {
            if (response.status === 400 && page > 1) break;
            throw new Error(`HTTP error: ${response.status}`);
          }

          const pageCategories = await response.json();
          categories.push(...pageCategories);

          const totalPages = Number(response.headers.get('X-WP-TotalPages') || 1);
          if (page >= totalPages) break;
          page++;
        }

        return {
          entries: categories.map((category) => ({
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
        const url = new URL(`${config.endpoint}/wp/v2/categories/${filter.id || filter.slug}`);
        const response = await fetch(url.toString());
        if (!response.ok) return { error: new Error('Category not found') };
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
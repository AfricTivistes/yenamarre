import type { LiveLoader } from 'astro/loaders';

interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  date: string;
}

export function wordpressLoader(config: { endpoint: string }): LiveLoader<Post> {
  return {
    name: 'wordpress-loader',
    loadCollection: async ({ filter }) => {
      try {
        const url = new URL(`${config.endpoint}/wp/v2/posts`);
        if (filter?.category) {
          url.searchParams.append('categories', filter.category);
        }
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const posts = await response.json();
        return {
          entries: posts.map((post) => ({
            id: post.id.toString(),
            data: {
              id: post.id,
              slug: post.slug,
              title: post.title.rendered,
              content: post.content.rendered,
              date: post.date,
            },
          })),
        };
      } catch (error) {
        return { error: new Error(`Failed to load posts: ${error.message}`) };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        const url = new URL(`${config.endpoint}/wp/v2/posts/${filter.id || filter.slug}`);
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
            date: post.date,
          },
          rendered: { html: post.content.rendered },
        };
      } catch (error) {
        return { error: new Error(`Failed to load post: ${error.message}`) };
      }
    },
  };
}
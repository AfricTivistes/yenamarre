import type { Loader } from 'astro/loaders';

/**
 * Loader générique pour un type de contenu WordPress exposé en REST
 * (ex: CPT créé avec ACF, `show_in_rest` activé).
 * Charge toutes les pages de résultats avec `_embed` (image mise en avant).
 * Si la route n'existe pas encore (404), la collection reste vide au lieu
 * de casser le build : les pages Astro retombent alors sur leur contenu de secours.
 */
export function wpTypeLoader({
  endpoint,
  restBase,
}: {
  endpoint: string;
  restBase: string;
}): Loader {
  if (!endpoint.endsWith('/')) endpoint += '/';
  return {
    name: `wp-type-${restBase}`,
    async load({ store, parseData, logger }) {
      const url = new URL(`wp/v2/${restBase}`, endpoint);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('_embed', 'true');
      store.clear();
      let page = 1;
      let totalPages = 1;
      do {
        url.searchParams.set('page', String(page));
        const res = await fetch(url);
        if (!res.ok) {
          logger.warn(`wp/v2/${restBase} → HTTP ${res.status}, collection vide`);
          return;
        }
        const items: any[] = await res.json();
        for (const raw of items) {
          const id = String(raw.id);
          const data = await parseData({ id, data: raw });
          store.set({
            id,
            data,
            ...(raw.content?.rendered ? { rendered: { html: raw.content.rendered } } : {}),
          });
        }
        totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
        page++;
      } while (page <= totalPages);
    },
  };
}

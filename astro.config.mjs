// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import netlify from "@astrojs/netlify/functions";

// https://astro.build/config
export default defineConfig({
  output: "server",
  // @ts-ignore
  adapter: netlify(),
  experimental: {
    liveContentCollections: true,
  },
  integrations: [tailwind()],
  server: {
    host: '0.0.0.0',
    port: 4321,
    allowedHosts: ["18d0e474-c0b3-44c1-8902-21abf05ddd5c-00-1arg6knanmatr.picard.replit.dev"]
  }
});
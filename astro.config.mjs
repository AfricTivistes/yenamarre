// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  server:{
    allowedHosts: ["d36d5b58-992e-49f0-ab04-180e1fc32199-00-26l6yrq9l7wcb.riker.replit.dev"]
  }
});
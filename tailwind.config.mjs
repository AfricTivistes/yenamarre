/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}", "*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        'yam-red': '#FF0000',
        'yam-black': '#000000',
        'yam-white': '#FFFFFF',
        'yam-green': '#00A651',
        'karibu-green': '#00A651',
        'karibu-yellow': '#FFC107',
        'karibu-red': '#D32F2F',
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
        'opensans': ['Open Sans', 'sans-serif'],
      },
      // fontWeight removed from here
    },
  },
  plugins: [],
  safelist: ['font-medium'],
}

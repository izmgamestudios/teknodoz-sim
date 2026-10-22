/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Brand color and corner radii come from CSS variables so the admin can change them at runtime.
      colors: {
        brand: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', dark: 'rgb(var(--brand-dark) / <alpha-value>)' },
      },
      borderRadius: { md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)' },
    },
  },
  plugins: [],
}

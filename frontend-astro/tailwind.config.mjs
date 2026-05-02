/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        'vf-navy':   '#1a0533',
        'vf-purple': '#6d28d9',
        'vf-coral':  '#f43f5e',
        'vf-orange': '#fb923c',
        'vf-teal':   '#0d9488',
      },
      backgroundImage: {
        'vf-gradient':      'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
        'vf-gradient-dark': 'linear-gradient(135deg, #1a0533 0%, #3b0764 100%)',
        'vf-gradient-soft': 'linear-gradient(135deg, #fdf2f8 0%, #fff7ed 100%)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'vf': '0 4px 24px rgba(244, 63, 94, 0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      }
    },
  },
  plugins: [],
}

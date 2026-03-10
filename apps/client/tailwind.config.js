/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'var(--la-color-background)',
        surface: 'var(--la-color-surface)',
        'surface-muted': 'var(--la-color-surface-muted)',
        border: 'var(--la-color-border)',
        text: 'var(--la-color-text)',
        'text-muted': 'var(--la-color-text-muted)',
        brand: {
          400: 'var(--la-color-brand-400)',
          500: 'var(--la-color-brand-500)',
          600: 'var(--la-color-brand-600)',
          950: 'var(--la-color-brand-950)',
        },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: '999px',
      },
      keyframes: {
        orbit: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(24px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.35)' },
          '50%': { boxShadow: '0 0 0 12px rgba(37,99,235,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        orbit: 'orbit 18s linear infinite',
        'fade-up': 'fade-up 0.6s var(--ease-standard) forwards',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        shimmer: 'shimmer 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', md: '1.5rem', lg: '2rem' }, screens: { '2xl': '1320px' } },
    extend: {
      colors: {
        plum: { 50: '#FBF3F6', 100: '#F5E3EA', 200: '#E9C3D2', 300: '#D495AE', 400: '#B35F83', 500: '#8A2F52', 600: '#6F2241', 700: '#5B1A32', 800: '#471427', 900: '#300C1A' },
        gold: { 50: '#FBF6EE', 100: '#F4E8D3', 200: '#E9D3A6', 300: '#DDBC85', 400: '#C9A46A', 500: '#B38A52', 600: '#9C7A45', 700: '#7C5F34' },
        ivory: '#FBF7F2',
        sand: '#F3ECE4',
        blush: '#F6E4E6',
        ink: { DEFAULT: '#2B2126', soft: '#5B4D53', muted: '#7A6A70' },
        line: '#EADFD8',
        success: '#2F7A55',
        danger: '#B42335',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(48,12,26,.04), 0 8px 24px -12px rgba(48,12,26,.12)',
        lift: '0 18px 40px -18px rgba(48,12,26,.28)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'fade-up': 'fade-up .4s ease-out both' },
    },
  },
  plugins: [typography],
} satisfies Config;

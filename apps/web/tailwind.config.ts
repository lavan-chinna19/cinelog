import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#10131F',
        surface: { DEFAULT: '#1C2233', raised: '#232A3E' },
        amber: { DEFAULT: '#F0A35E', soft: '#F0A35E1F' },
        lavender: { DEFAULT: '#A78BFA', soft: '#A78BFA1F' },
        ink: { DEFAULT: '#E8EAF0', muted: '#9299AC' },
        success: '#52B788',
        notify: '#F16D76',
        line: '#343B50',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        accent: ['var(--font-accent)', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        glow: '0 0 0 1px #343B50, 0 20px 50px -20px rgba(240,163,94,0.25)',
        card: '0 10px 30px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up .35s ease-out both',
        'scale-in': 'scale-in .2s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;

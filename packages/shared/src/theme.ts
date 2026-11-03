/** CineLog design tokens — shared by web (Tailwind) and mobile (StyleSheet). */
export const colors = {
  bg: '#10131F',
  surface: '#1C2233',
  surfaceRaised: '#232A3E',
  amber: '#F0A35E',
  lavender: '#A78BFA',
  text: '#E8EAF0',
  textMuted: '#9299AC',
  success: '#52B788',
  notify: '#F16D76',
  border: '#343B50',
} as const;

export const fonts = {
  heading: 'Space Grotesk',
  body: 'Inter',
  accent: 'Playfair Display',
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const TAGLINE = 'Your movies. Your memories. Your people.';

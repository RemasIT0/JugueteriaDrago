/** @type {import('tailwindcss').Config} */

// Los colores del tema viven como canales RGB en CSS variables (src/index.css),
// así el modo oscuro solo redefine variables y las clases no cambian.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ground: v('ground'),
        surface: v('surface'),
        sunken: v('sunken'),
        line: v('line'),
        ink: { DEFAULT: v('ink'), soft: v('ink-soft') },
        'on-fill': v('on-fill'),
        rail: { DEFAULT: v('rail'), ink: v('rail-ink'), hover: v('rail-hover') },
        // Casillas del tablero: una por familia de categoría.
        sol: { DEFAULT: v('sol'), ink: v('sol-ink'), wash: v('sol-wash') },
        coral: { DEFAULT: v('coral'), ink: v('coral-ink'), wash: v('coral-wash') },
        turquesa: { DEFAULT: v('turquesa'), ink: v('turquesa-ink'), wash: v('turquesa-wash') },
        lila: { DEFAULT: v('lila'), ink: v('lila-ink'), wash: v('lila-wash') },
        hoja: { DEFAULT: v('hoja'), ink: v('hoja-ink'), wash: v('hoja-wash') },
        cielo: { DEFAULT: v('cielo'), ink: v('cielo-ink'), wash: v('cielo-wash') },
        // Estados con significado (stock, errores).
        peligro: { DEFAULT: v('peligro'), wash: v('peligro-wash') },
      },
      fontFamily: {
        sans: ['"Nunito Variable"', 'Nunito', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        // Sombras suaves con desplazamiento: la "caja" apoyada sobre la mesa.
        card: '0 1px 0 rgb(var(--line)), 0 14px 30px -20px rgb(var(--shadow) / 0.45)',
        lift: '0 2px 0 rgb(var(--line)), 0 22px 40px -22px rgb(var(--shadow) / 0.55)',
        drawer: '-24px 0 60px -30px rgb(var(--shadow) / 0.6)',
        focus: '0 0 0 4px rgb(var(--turquesa) / 0.28)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
    },
  },
  plugins: [],
}

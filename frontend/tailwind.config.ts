import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-ink)',
        'slate-700': 'var(--color-slate-700)',
        'slate-500': 'var(--color-slate-500)',
        'slate-200': 'var(--color-slate-200)',
        'slate-100': 'var(--color-slate-100)',
        surface: 'var(--color-surface)',
        canvas: 'var(--color-canvas)',
        'brand-700': 'var(--color-brand-700)',
        'brand-600': 'var(--color-brand-600)',
        'brand-50': 'var(--color-brand-50)',
        'amber-600': 'var(--color-amber-600)',
        'red-700': 'var(--color-red-700)',
        'blue-600': 'var(--color-blue-600)',
        score: {
          '0': '#F1F5F9',
          '20': '#A7F3D0',
          '40': '#6EE7B7',
          '60': '#34D399',
          '80': '#059669',
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        chip: '4px',
        input: '4px',
        btn: '6px',
        tile: '6px',
        panel: '10px',
        sheet: '10px',
      },
      boxShadow: {
        float: '0 4px 12px rgba(15, 23, 42, 0.10)',
        sheet: '0 -8px 24px rgba(15, 23, 42, 0.12)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '13': '52px',
      },
    },
  },
  plugins: [],
} satisfies Config;

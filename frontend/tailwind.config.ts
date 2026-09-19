import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0F172A',
        'slate-700': '#334155',
        'slate-500': '#64748B',
        'slate-200': '#E2E8F0',
        'slate-100': '#F1F5F9',
        surface: '#FFFFFF',
        canvas: '#F8FAFC',
        'brand-700': '#047857',
        'brand-600': '#059669',
        'brand-50': '#ECFDF5',
        'amber-600': '#D97706',
        'red-700': '#B91C1C',
        'blue-600': '#2563EB',
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

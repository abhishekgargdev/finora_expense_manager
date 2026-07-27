const plugin = require('tailwindcss/plugin');
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx,js,jsx}',
    './src/components/**/*.{ts,tsx,js,jsx}',
    './src/pages/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui'],
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      const newUtilities = {
        '.text-income': { color: 'var(--income)' },
        '.text-expense': { color: 'var(--expense)' },
        '.text-investment': { color: 'var(--investment)' },
        '.text-pending': { color: 'var(--pending)' },
        '.text-settled': { color: 'var(--settled)' },
        '.bg-income-10': { 'background-color': 'rgba(var(--income-rgb), 0.08)' },
        '.bg-expense-10': { 'background-color': 'rgba(var(--expense-rgb), 0.08)' },
        '.bg-investment-10': { 'background-color': 'rgba(var(--investment-rgb), 0.06)' },
        '.bg-pending-10': { 'background-color': 'rgba(var(--pending-rgb), 0.06)' },
        '.bg-settled-10': { 'background-color': 'rgba(var(--settled-rgb), 0.06)' },
        '.card': {
          'background-color': 'var(--card-bg)',
          'border': '1px solid var(--card-border)',
          'border-radius': 'var(--radius-lg)',
          'box-shadow': '0 6px 18px rgba(2,6,23,0.06)'
        }
      };
      addUtilities(newUtilities, ['responsive']);
    }),
  ],
};

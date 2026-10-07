/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        lilac: {
          50: 'rgb(var(--color-theme-50-rgb, 245 243 255) / <alpha-value>)',
          100: 'rgb(var(--color-theme-100-rgb, 237 233 254) / <alpha-value>)',
          200: 'rgb(var(--color-theme-200-rgb, 221 214 254) / <alpha-value>)',
          300: 'rgb(var(--color-theme-300-rgb, 196 181 253) / <alpha-value>)',
          400: 'rgb(var(--color-theme-400-rgb, 167 139 250) / <alpha-value>)',
          500: 'rgb(var(--color-theme-500-rgb, 139 92 246) / <alpha-value>)',
          600: 'rgb(var(--color-theme-600-rgb, 124 58 237) / <alpha-value>)',
          700: 'rgb(var(--color-theme-700-rgb, 109 40 217) / <alpha-value>)',
          800: 'rgb(var(--color-theme-800-rgb, 91 33 182) / <alpha-value>)',
          900: 'rgb(var(--color-theme-900-rgb, 76 29 149) / <alpha-value>)',
          950: 'rgb(var(--color-theme-950-rgb, 46 16 101) / <alpha-value>)'
        }
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100'
      }
    }
  },
  plugins: []
}

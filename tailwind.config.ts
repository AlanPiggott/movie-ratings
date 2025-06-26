import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0E0F13',
        foreground: '#F5F5F5',
        primary: {
          DEFAULT: '#F5C518',
          foreground: '#0E0F13',
        },
        secondary: {
          DEFAULT: '#1A1B1F',
          foreground: '#F5F5F5',
        },
        muted: {
          DEFAULT: '#27282C',
          foreground: '#A0A0A0',
        },
        accent: {
          DEFAULT: '#F5C518',
          foreground: '#0E0F13',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#F5F5F5',
        },
        border: '#27282C',
        input: '#27282C',
        ring: '#F5C518',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter Tight', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
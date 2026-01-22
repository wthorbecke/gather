import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm, organic palette from the prototype
        bg: '#FAF9F7',
        'bg-warm': '#F5F3EF',
        'bg-card': '#FFFFFF',
        border: '#E8E4DD',
        'border-light': '#F0EDE8',
        text: '#2C2825',
        'text-soft': '#6B635A',
        'text-muted': '#9B9389',
        accent: '#8B7355',
        'accent-soft': '#C4B5A0',
        sage: '#7D8B75',
        'sage-soft': '#E8EBE6',
        rose: '#C4A07A',
        'rose-soft': '#F5EDE4',
        sky: '#7A95A8',
        'sky-soft': '#E8EEF2',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(44, 40, 37, 0.04)',
        'soft-hover': '0 4px 16px rgba(44, 40, 37, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // v17 Gather palette - gold/amber accent, sage success
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        card: 'var(--card)',
        'card-hover': 'var(--card-hover)',
        subtle: 'var(--subtle)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        'border-focus': 'var(--border-focus)',
        text: {
          DEFAULT: 'var(--text)',
          soft: 'var(--text-soft)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          text: 'var(--accent-text)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },
        link: {
          DEFAULT: 'var(--link)',
          soft: 'var(--link-soft)',
        },
        ai: {
          bg: 'var(--ai-bg)',
          border: 'var(--ai-border)',
        },
        'user-bg': 'var(--user-bg)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        serif: ['var(--font-serif)'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '13px',
        'base': '14px',
        'lg': '16px',
        'xl': '18px',
        '2xl': '20px',
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'soft': '0 2px 12px -4px rgba(0, 0, 0, 0.08)',
        'hover': '0 8px 24px -8px rgba(0, 0, 0, 0.12)',
        'elevated': '0 0 0 3px var(--accent-soft), 0 20px 40px -15px rgba(0, 0, 0, 0.12)',
        'modal': '0 20px 60px -15px rgba(0, 0, 0, 0.3)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-up': 'fadeUp 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'modal-in': 'modalIn 0.22s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'modal-out': 'modalOut 0.2s cubic-bezier(0.4, 0, 1, 1) forwards',
        'backdrop-in': 'backdropIn 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'backdrop-out': 'backdropOut 0.18s cubic-bezier(0.4, 0, 1, 1) forwards',
        'float': 'float 1.5s ease-in-out infinite',
        'dot-pulse': 'dotPulse 0.9s ease-in-out infinite',
        'celebrate': 'celebrateIn 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        modalOut: {
          from: { opacity: '1', transform: 'scale(1) translateY(0)' },
          to: { opacity: '0', transform: 'scale(0.96) translateY(10px)' },
        },
        backdropIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        backdropOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        dotPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%': { transform: 'scale(1.2)', opacity: '1' },
        },
        celebrateIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.8)' },
          '50%': { transform: 'translate(-50%, -50%) scale(1.05)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-100vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        checkDraw: {
          from: { strokeDashoffset: '16' },
          to: { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}

export default config

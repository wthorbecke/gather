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
        // Background layers
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        card: 'var(--card)',
        'card-hover': 'var(--card-hover)',
        elevated: 'var(--elevated)',
        subtle: 'var(--subtle)',

        // Borders
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        'border-focus': 'var(--border-focus)',

        // Text hierarchy
        text: {
          DEFAULT: 'var(--text)',
          soft: 'var(--text-soft)',
          muted: 'var(--text-muted)',
        },

        // Accent (coral)
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          text: 'var(--accent-text)',
        },

        // Success (sage)
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },

        // Danger
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },

        // Links
        link: {
          DEFAULT: 'var(--link)',
          soft: 'var(--link-soft)',
        },

        // AI card
        ai: {
          bg: 'var(--ai-bg)',
          border: 'var(--ai-border)',
        },
        'user-bg': 'var(--user-bg)',
      },

      fontFamily: {
        // System font for body, Fraunces for display
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],  // Fraunces for "Gather" title
        serif: ['var(--font-sans)'],
      },

      // Typography scale - consistent sizing
      fontSize: {
        'xs': ['12px', { lineHeight: '1.5' }],
        'sm': ['13px', { lineHeight: '1.5' }],
        'base': ['14px', { lineHeight: '1.6' }],
        'lg': ['16px', { lineHeight: '1.5' }],
        'xl': ['18px', { lineHeight: '1.4' }],
        '2xl': ['20px', { lineHeight: '1.3' }],
        '3xl': ['24px', { lineHeight: '1.2' }],
        '4xl': ['32px', { lineHeight: '1.1' }],
      },

      // Border radius - SIMPLIFIED to 2 values
      borderRadius: {
        'sm': 'var(--radius-sm)',  // 6px - small elements
        'md': 'var(--radius-md)',  // 8px - everything else
        'lg': 'var(--radius-md)',  // Same as md for consistency
        'xl': 'var(--radius-md)',  // Same as md for consistency
        '2xl': 'var(--radius-md)', // Same as md for consistency
      },

      // Shadow scale - SIMPLIFIED using CSS vars
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'card': 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
        'soft': 'var(--shadow-sm)',
        'hover': 'var(--shadow-md)',
        'elevated': 'var(--shadow-md)',
        'modal': 'var(--shadow-lg)',
        'focus': '0 0 0 3px var(--accent-soft)',
      },

      // Timing functions
      transitionTimingFunction: {
        'out': 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        'in-out': 'cubic-bezier(0.45, 0, 0.55, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // Animations
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

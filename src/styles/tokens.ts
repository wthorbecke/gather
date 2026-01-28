/**
 * Design System Tokens
 *
 * These tokens define the visual language of Gather.
 * Every component must use these tokens - no magic numbers.
 *
 * Usage with Tailwind: These are used via CSS variables defined in globals.css.
 * This file serves as documentation and for TypeScript consumers.
 */

export const tokens = {
  // ===========================================
  // COLORS
  // CSS variables are defined in globals.css
  // ===========================================
  colors: {
    // Backgrounds (layered, darkest to lightest in light mode)
    canvas: 'var(--canvas)',           // Main page background
    surface: 'var(--surface)',         // Subtle layer on canvas (hover states, borders)
    card: 'var(--card)',               // Cards, elevated surfaces
    elevated: 'var(--elevated)',       // Modals, prominent surfaces

    // Text hierarchy
    text: 'var(--text)',               // Primary text
    textSoft: 'var(--text-soft)',      // Secondary text
    textMuted: 'var(--text-muted)',    // Tertiary text, placeholders

    // Accent (coral) - primary actions
    accent: 'var(--accent)',
    accentSoft: 'var(--accent-soft)',
    accentText: 'var(--accent-text)',

    // Success (sage) - completion states only
    success: 'var(--success)',
    successSoft: 'var(--success-soft)',

    // Danger - destructive actions
    danger: 'var(--danger)',
    dangerSoft: 'var(--danger-soft)',

    // Border
    border: 'var(--border)',
    borderSubtle: 'var(--border-subtle)',
  },

  // ===========================================
  // SPACING
  // Use Tailwind classes: p-1 = 4px, p-2 = 8px, etc.
  // ===========================================
  spacing: {
    xs: '4px',   // 1 - Tight gaps
    sm: '8px',   // 2 - Component internals
    md: '16px',  // 4 - Standard padding
    lg: '24px',  // 6 - Card padding, section gaps
    xl: '32px',  // 8 - Major section spacing
    xxl: '48px', // 12 - Page margins
  },

  // ===========================================
  // BORDER RADIUS
  // Tailwind: rounded-sm, rounded-md, rounded-lg, rounded-xl
  // ===========================================
  radius: {
    sm: '6px',     // Small elements, badges
    md: '10px',    // Buttons, inputs
    lg: '12px',    // Cards
    xl: '16px',    // Large cards, modals
    full: '9999px', // Pills, circular
  },

  // ===========================================
  // SHADOWS
  // Defined in tailwind.config.ts
  // ===========================================
  shadows: {
    // Card shadows
    card: '0 1px 2px rgba(0,0,0,0.04)',
    cardHover: '0 4px 12px rgba(0,0,0,0.08)',

    // Elevated surfaces (modals, dropdowns)
    elevated: '0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.03)',

    // Focus rings
    focus: '0 0 0 4px var(--accent-soft)',
  },

  // ===========================================
  // TYPOGRAPHY
  // Use Tailwind: text-xs, text-sm, text-base, text-lg, text-xl
  // ===========================================
  typography: {
    // Font sizes - matches tailwind.config.ts
    xs: '12px',   // Labels, badges
    sm: '13px',   // Secondary text
    base: '14px', // Body text
    lg: '16px',   // Primary text, step titles
    xl: '18px',   // Headings
    '2xl': '20px', // Large headings

    // Font weights
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // ===========================================
  // TRANSITIONS
  // Use Tailwind: transition-all duration-150 ease-out
  // ===========================================
  transitions: {
    fast: '100ms',
    base: '150ms',
    slow: '200ms',

    // Easing (defined as CSS vars in globals.css)
    easeOut: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    easeInOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
  },
} as const

// ===========================================
// COMPONENT PATTERNS
// Standard configurations for common elements
// ===========================================

export const patterns = {
  // Card pattern
  card: {
    background: 'bg-card',
    border: 'border border-border',
    radius: 'rounded-lg',
    padding: 'p-4',
    shadow: 'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
    hover: 'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-border',
  },

  // Primary button
  buttonPrimary: {
    background: 'bg-accent',
    text: 'text-white',
    padding: 'px-4 py-2.5',
    radius: 'rounded-md',
    hover: 'hover:bg-accent/90',
    active: 'active:scale-[0.98]',
  },

  // Secondary button
  buttonSecondary: {
    background: 'bg-transparent',
    border: 'border border-border',
    text: 'text-text',
    padding: 'px-4 py-2.5',
    radius: 'rounded-md',
    hover: 'hover:bg-surface hover:border-accent',
  },

  // Input
  input: {
    background: 'bg-elevated',
    border: 'border-transparent',
    radius: 'rounded-xl',
    padding: 'px-4 py-4',
    focus: 'focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)]',
  },

  // Step item - normal state
  stepItem: {
    background: 'bg-transparent',
    borderLeft: 'border-l-2 border-l-transparent',
    padding: 'p-4',
    radius: 'rounded-lg',
    hover: 'hover:bg-surface/50',
  },

  // Step item - next/active state
  stepItemNext: {
    background: 'bg-success/[0.06]',
    borderLeft: 'border-l-2 border-l-success',
  },

  // Step item - expanded state
  stepItemExpanded: {
    background: 'bg-card',
    border: 'border border-border',
    shadow: 'shadow-sm',
  },
} as const

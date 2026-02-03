'use client'

import { forwardRef } from 'react'

export type CardVariant = 'primary' | 'surface'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card visual variant */
  variant?: CardVariant
  /** Padding size - defaults to 'md' (p-4) */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Additional class names */
  className?: string
  /** Card contents */
  children: React.ReactNode
}

const variantClasses: Record<CardVariant, string> = {
  primary: 'bg-card rounded-xl border border-border-subtle',
  surface: 'bg-surface rounded-xl',
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

/**
 * Unified Card component with standardized variants.
 *
 * Variants:
 * - `primary`: Interactive/prominent cards (bg-card with subtle border)
 * - `surface`: Informational/de-emphasized cards (bg-surface, no border)
 *
 * @example
 * // Primary card (default)
 * <Card variant="primary">Content</Card>
 *
 * // Surface card
 * <Card variant="surface">Content</Card>
 *
 * // With custom padding
 * <Card variant="primary" padding="lg">Content</Card>
 *
 * // With additional styles
 * <Card variant="surface" className="hover:shadow-md">Content</Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      variant = 'primary',
      padding = 'md',
      className = '',
      children,
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

/**
 * CSS class exports for cases where the component can't be used directly.
 * These match the component variants exactly.
 */
export const cardClasses = {
  primary: variantClasses.primary,
  surface: variantClasses.surface,
} as const

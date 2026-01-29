'use client'

import { useMemo, ReactNode } from 'react'

/**
 * RichText - Renders text with URLs converted to styled link buttons
 *
 * AI responses often contain raw URLs that should be displayed as clean,
 * clickable buttons. This component:
 * 1. Detects URLs in text
 * 2. Generates meaningful labels based on the domain/path
 * 3. Renders them as styled external link buttons
 */

// URL pattern - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi

// Domain to friendly name mapping
const DOMAIN_LABELS: Record<string, string> = {
  'google.com/travel/flights': 'Search flights',
  'google.com/flights': 'Search flights',
  'google.com/maps': 'View on Google Maps',
  'google.com/search': 'Search Google',
  'maps.google.com': 'View on Google Maps',
  'amazon.com': 'View on Amazon',
  'yelp.com': 'View on Yelp',
  'tripadvisor.com': 'View on TripAdvisor',
  'booking.com': 'View on Booking.com',
  'airbnb.com': 'View on Airbnb',
  'expedia.com': 'View on Expedia',
  'kayak.com': 'Search on Kayak',
  'skyscanner.com': 'Search on Skyscanner',
  'opentable.com': 'Reserve on OpenTable',
  'doordash.com': 'Order on DoorDash',
  'ubereats.com': 'Order on Uber Eats',
  'grubhub.com': 'Order on Grubhub',
  'irs.gov': 'View on IRS.gov',
  'dmv.ca.gov': 'View on CA DMV',
  'dmv.ny.gov': 'View on NY DMV',
  'usa.gov': 'View on USA.gov',
  'healthcare.gov': 'View on Healthcare.gov',
  'medicare.gov': 'View on Medicare.gov',
  'ssa.gov': 'View on SSA.gov',
  'youtube.com': 'Watch on YouTube',
  'youtu.be': 'Watch on YouTube',
  'vimeo.com': 'Watch on Vimeo',
  'github.com': 'View on GitHub',
  'linkedin.com': 'View on LinkedIn',
  'twitter.com': 'View on Twitter',
  'x.com': 'View on X',
  'facebook.com': 'View on Facebook',
  'instagram.com': 'View on Instagram',
  'reddit.com': 'View on Reddit',
  'wikipedia.org': 'Read on Wikipedia',
  'nytimes.com': 'Read on NY Times',
  'washingtonpost.com': 'Read on Washington Post',
  'wsj.com': 'Read on WSJ',
  'bbc.com': 'Read on BBC',
  'cnn.com': 'Read on CNN',
  'spotify.com': 'Listen on Spotify',
  'apple.com/music': 'Listen on Apple Music',
}

// Category-based labels when domain isn't recognized
const PATH_LABELS: Record<string, string> = {
  '/search': 'Search',
  '/flights': 'Search flights',
  '/hotels': 'Search hotels',
  '/maps': 'View map',
  '/directions': 'Get directions',
  '/restaurants': 'View restaurants',
  '/reviews': 'Read reviews',
  '/booking': 'Book now',
  '/reserve': 'Reserve',
  '/order': 'Order',
  '/buy': 'Buy',
  '/shop': 'Shop',
  '/checkout': 'Checkout',
  '/appointment': 'Schedule',
  '/schedule': 'Schedule',
  '/apply': 'Apply',
  '/forms': 'View forms',
  '/download': 'Download',
  '/contact': 'Contact',
  '/support': 'Get support',
  '/help': 'Get help',
}

// File extension labels
const FILE_LABELS: Record<string, string> = {
  '.pdf': 'Download PDF',
  '.doc': 'Download document',
  '.docx': 'Download document',
  '.xls': 'Download spreadsheet',
  '.xlsx': 'Download spreadsheet',
  '.zip': 'Download file',
}

/**
 * Generate a human-readable label for a URL
 */
function getLabelForUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')
    const pathname = parsed.pathname.toLowerCase()

    // Check for exact domain matches first
    for (const [domain, label] of Object.entries(DOMAIN_LABELS)) {
      if (hostname.includes(domain.split('/')[0])) {
        const domainPath = domain.split('/').slice(1).join('/')
        if (!domainPath || pathname.includes(domainPath)) {
          return label
        }
      }
    }

    // Check for file extensions
    for (const [ext, label] of Object.entries(FILE_LABELS)) {
      if (pathname.endsWith(ext)) {
        return label
      }
    }

    // Check for path-based patterns
    for (const [pathPart, label] of Object.entries(PATH_LABELS)) {
      if (pathname.includes(pathPart)) {
        return label
      }
    }

    // Check for tel: links
    if (url.startsWith('tel:')) {
      const number = url.replace('tel:', '')
      return `Call ${number}`
    }

    // Check for mailto: links
    if (url.startsWith('mailto:')) {
      return 'Send email'
    }

    // Fallback: Use domain name
    const domainParts = hostname.split('.')
    const siteName = domainParts.length > 2 ? domainParts[1] : domainParts[0]
    return `Visit ${siteName.charAt(0).toUpperCase() + siteName.slice(1)}`
  } catch {
    return 'Open link'
  }
}

/**
 * Check if text around a URL suggests it's described/labeled
 * This helps us avoid showing redundant text
 */
function getContextAroundUrl(text: string, url: string): { before: string; after: string } {
  const urlIndex = text.indexOf(url)
  if (urlIndex === -1) return { before: '', after: '' }

  const before = text.slice(Math.max(0, urlIndex - 100), urlIndex).trim()
  const after = text.slice(urlIndex + url.length, urlIndex + url.length + 50).trim()

  return { before, after }
}

/**
 * Phrases that typically precede URLs and can be cleaned up
 */
const LINK_INTRO_PHRASES = [
  'here\'s a link:',
  'here\'s the link:',
  'here is a link:',
  'here is the link:',
  'click here:',
  'direct link:',
  'link:',
  'url:',
  'visit:',
  'go to:',
  'check out:',
  'see:',
  'here:',
  'here\'s a direct link',
  'here is a direct link',
]

interface RichTextProps {
  children: string
  className?: string
}

interface TextPart {
  type: 'text' | 'url'
  content: string
  label?: string
}

export function RichText({ children, className = '' }: RichTextProps) {
  const parts = useMemo((): TextPart[] => {
    if (!children) return []

    const result: TextPart[] = []
    let lastIndex = 0
    let text = children

    // Find all URLs
    const matches = Array.from(text.matchAll(URL_REGEX))

    if (matches.length === 0) {
      return [{ type: 'text', content: text }]
    }

    for (const match of matches) {
      const url = match[0]
      const urlIndex = match.index!

      // Get text before this URL
      if (urlIndex > lastIndex) {
        let beforeText = text.slice(lastIndex, urlIndex)

        // Clean up intro phrases that precede URLs
        const lowerBefore = beforeText.toLowerCase()
        for (const phrase of LINK_INTRO_PHRASES) {
          if (lowerBefore.trim().endsWith(phrase)) {
            beforeText = beforeText.slice(0, lowerBefore.lastIndexOf(phrase)).trim()
            break
          }
        }

        if (beforeText.trim()) {
          result.push({ type: 'text', content: beforeText })
        }
      }

      // Add the URL
      result.push({
        type: 'url',
        content: url,
        label: getLabelForUrl(url),
      })

      lastIndex = urlIndex + url.length
    }

    // Get remaining text after last URL
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex)
      if (afterText.trim()) {
        result.push({ type: 'text', content: afterText })
      }
    }

    return result
  }, [children])

  if (parts.length === 0) return null

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>
        }

        // Render URL as a styled button
        return (
          <a
            key={index}
            href={part.content}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5 my-1 mx-0.5
              bg-accent text-white
              text-sm font-medium
              rounded-lg
              hover:bg-accent/90
              transition-colors duration-150
              btn-press
              no-underline
            "
            onClick={(e) => e.stopPropagation()}
          >
            {part.label}
            <svg
              width={12}
              height={12}
              viewBox="0 0 12 12"
              className="flex-shrink-0"
              aria-hidden="true"
            >
              <path
                d="M3 9L9 3M9 3H5M9 3V7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </a>
        )
      })}
    </span>
  )
}

/**
 * Standalone function to clean message and render with rich text
 * Use this in components that need to process AI messages
 */
export function renderRichMessage(message: string): ReactNode {
  return <RichText>{message}</RichText>
}

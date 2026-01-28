export interface SourceRef {
  title: string
  url: string
}

const LOW_QUALITY_HOSTS = [
  'wikipedia.org',
  'reddit.com',
  'quora.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'linkedin.com',
  'medium.com',
  'substack.com',
  'blogspot.com',
  'wordpress.com',
]

const NEWS_HOSTS = [
  'apnews.com',
  'bbc.co.uk',
  'bloomberg.com',
  'bankrate.com',
  'cnn.com',
  'foxnews.com',
  'sacbee.com',
  'nytimes.com',
  'reuters.com',
  'theguardian.com',
  'usatoday.com',
  'usnews.com',
  'washingtonpost.com',
]

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export const isAuthoritativeSource = (url: string) => {
  const host = getHostname(url)
  if (!host) return false
  if (host.endsWith('.gov') || host.endsWith('.mil') || host.endsWith('.edu')) return true
  if (/\.(state|city|county|co|parish|gov|muni)\.[a-z]{2}\.us$/.test(host)) return true
  return false
}

export const isLowQualitySource = (url: string) => {
  const host = getHostname(url)
  return LOW_QUALITY_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

export const isNewsSource = (url: string) => {
  const host = getHostname(url)
  return NEWS_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

export const scoreSource = (url: string) => {
  if (isAuthoritativeSource(url)) return 100
  if (isLowQualitySource(url)) return 10
  if (isNewsSource(url)) return 20
  const host = getHostname(url)
  if (host.endsWith('.org')) return 55
  return 45
}

export const hasAuthoritativeSources = (sources: SourceRef[]) =>
  sources.some((source) => isAuthoritativeSource(source.url))

export const prioritizeSources = (sources: SourceRef[]) => {
  const seen = new Set<string>()
  const unique = sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false
    seen.add(source.url)
    return true
  })

  const scored = unique.map((source) => ({
    source,
    score: scoreSource(source.url),
    authoritative: isAuthoritativeSource(source.url),
    lowQuality: isLowQualitySource(source.url),
    news: isNewsSource(source.url),
  }))

  const hasAuthoritative = scored.some((item) => item.authoritative)
  let pool = scored
  if (hasAuthoritative) {
    pool = scored.filter((item) => item.authoritative)
  } else {
    const nonNews = scored.filter((item) => !item.lowQuality && !item.news)
    pool = nonNews.length > 0 ? nonNews : []
  }

  return pool
    .sort((a, b) => b.score - a.score)
    .map((item) => item.source)
}

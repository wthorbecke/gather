export interface SplitStepTextResult {
  title: string
  remainder: string
}

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim()

export const splitStepText = (text: string, maxTitleLength = 60): SplitStepTextResult => {
  const trimmed = normalizeWhitespace(text)
  if (!trimmed) return { title: '', remainder: '' }
  if (trimmed.length <= maxTitleLength) {
    return { title: trimmed, remainder: '' }
  }

  const parenIndex = trimmed.indexOf(' (')
  if (parenIndex >= 18 && parenIndex <= maxTitleLength + 12) {
    return {
      title: trimmed.slice(0, parenIndex).trim(),
      remainder: trimmed.slice(parenIndex + 2).replace(/\)$/, '').trim(),
    }
  }

  const strongSeparators = [' - ', ': ', '; ']
  for (const sep of strongSeparators) {
    const idx = trimmed.indexOf(sep)
    if (idx >= 18 && idx <= maxTitleLength + 18) {
      const remainder = trimmed.slice(idx + sep.length).trim()
      if (remainder.length >= 10) {
        return { title: trimmed.slice(0, idx).trim(), remainder }
      }
    }
  }

  const clauseSeparators = [' so that ', ' so you can ', ' so you ', ' in order to ', ' which ', ' by ', ' if ', ' when ', ' before ', ' after ']
  for (const sep of clauseSeparators) {
    const idx = trimmed.indexOf(sep)
    if (idx >= 28 && idx <= maxTitleLength + 28) {
      const remainder = trimmed.slice(idx + sep.length).trim()
      if (remainder.length >= 10) {
        return { title: trimmed.slice(0, idx).trim(), remainder }
      }
    }
  }

  const softSeparators = [', ', ' within ', ' for ', ' dated ', ' at ', ' to ']
  for (const sep of softSeparators) {
    const idx = trimmed.indexOf(sep)
    if (idx >= 24 && idx <= maxTitleLength + 22) {
      const remainder = trimmed.slice(idx + sep.length).trim()
      if (remainder.length >= 10) {
        return { title: trimmed.slice(0, idx).trim(), remainder }
      }
    }
  }

  const lastSpace = trimmed.lastIndexOf(' ', maxTitleLength)
  const cutIndex = lastSpace >= 30 ? lastSpace : maxTitleLength
  const title = trimmed.slice(0, cutIndex).trim()
  const remainder = trimmed.slice(cutIndex).trim()
  return remainder ? { title, remainder } : { title: trimmed, remainder: '' }
}

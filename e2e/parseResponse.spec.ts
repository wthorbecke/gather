import { test, expect } from '@playwright/test'
import {
  parseAIMessage,
  parseAIResponseFull,
  parseStreamingMessage,
  unescapeJsonString,
  stripCiteTags,
  cleanAIMessage,
} from '../src/lib/ai/parseResponse'

/**
 * Unit tests for AI response parsing utilities
 * These test pure functions directly without browser interaction
 */

test.describe('parseAIMessage', () => {
  test('extracts message from valid JSON response', () => {
    const input = '{"message":"Here is your answer.","actions":[]}'
    expect(parseAIMessage(input)).toBe('Here is your answer.')
  })

  test('extracts message with actions array', () => {
    const input = '{"message":"Try this.","actions":[{"type":"mark_step_done","stepId":"1"}]}'
    expect(parseAIMessage(input)).toBe('Try this.')
  })

  test('handles newlines in message', () => {
    const input = '{"message":"Line 1\\nLine 2\\nLine 3","actions":[]}'
    expect(parseAIMessage(input)).toBe('Line 1\nLine 2\nLine 3')
  })

  test('handles escaped quotes in message', () => {
    const input = '{"message":"He said \\"hello\\"","actions":[]}'
    expect(parseAIMessage(input)).toBe('He said "hello"')
  })

  test('handles escaped backslashes in message', () => {
    const input = '{"message":"Path: C:\\\\Users\\\\test","actions":[]}'
    expect(parseAIMessage(input)).toBe('Path: C:\\Users\\test')
  })

  test('returns raw text for non-JSON input', () => {
    const input = 'This is just plain text.'
    expect(parseAIMessage(input)).toBe('This is just plain text.')
  })

  test('returns raw text when JSON is invalid', () => {
    const input = '{"message":"incomplete'
    expect(parseAIMessage(input)).toBe('{"message":"incomplete')
  })

  test('extracts message using regex when JSON parse fails', () => {
    // Invalid JSON (missing closing brace) but has parseable message
    const input = '{"message":"Extracted from regex","actions":[invalid]'
    expect(parseAIMessage(input)).toBe('Extracted from regex')
  })

  test('handles empty string', () => {
    expect(parseAIMessage('')).toBe('')
  })

  test('trims whitespace', () => {
    const input = '  {"message":"Trimmed"}  '
    expect(parseAIMessage(input)).toBe('Trimmed')
  })

  test('handles message with special characters', () => {
    const input = '{"message":"Cost is $50 & includes tax (15%)","actions":[]}'
    expect(parseAIMessage(input)).toBe('Cost is $50 & includes tax (15%)')
  })

  test('handles multiline JSON with message spanning lines', () => {
    const input = `{
  "message": "First line.\\nSecond line.",
  "actions": []
}`
    expect(parseAIMessage(input)).toBe('First line.\nSecond line.')
  })
})

test.describe('parseAIResponseFull', () => {
  test('returns message and actions from valid JSON', () => {
    const input = '{"message":"Hello","actions":[{"type":"show_sources","label":"View sources"}]}'
    const result = parseAIResponseFull(input)

    expect(result.message).toBe('Hello')
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('show_sources')
    expect(result.raw).toBe(input)
  })

  test('returns empty actions when not present', () => {
    const input = '{"message":"Just a message"}'
    const result = parseAIResponseFull(input)

    expect(result.message).toBe('Just a message')
    expect(result.actions).toEqual([])
  })

  test('handles plain text input', () => {
    const input = 'Plain text response'
    const result = parseAIResponseFull(input)

    expect(result.message).toBe('Plain text response')
    expect(result.actions).toEqual([])
    expect(result.raw).toBe(input)
  })

  test('handles empty input', () => {
    const result = parseAIResponseFull('')

    expect(result.message).toBe('')
    expect(result.actions).toEqual([])
    expect(result.raw).toBe('')
  })

  test('extracts JSON from mixed content', () => {
    const input = 'Some prefix {"message":"Found it","actions":[]} some suffix'
    const result = parseAIResponseFull(input)

    expect(result.message).toBe('Found it')
  })
})

test.describe('parseStreamingMessage', () => {
  test('extracts partial message during streaming', () => {
    const input = '{"message":"Working on it'
    expect(parseStreamingMessage(input)).toBe('Working on it')
  })

  test('handles complete message in streaming context', () => {
    const input = '{"message":"Complete response","actions":[]}'
    expect(parseStreamingMessage(input)).toBe('Complete response')
  })

  test('handles escape sequences during streaming', () => {
    const input = '{"message":"Line 1\\nLine 2'
    expect(parseStreamingMessage(input)).toBe('Line 1\nLine 2')
  })

  test('handles escaped quotes during streaming', () => {
    const input = '{"message":"He said \\"hi'
    expect(parseStreamingMessage(input)).toBe('He said "hi')
  })

  test('handles escaped tabs during streaming', () => {
    const input = '{"message":"Column1\\tColumn2'
    expect(parseStreamingMessage(input)).toBe('Column1\tColumn2')
  })

  test('handles escaped backslash during streaming', () => {
    const input = '{"message":"path\\\\to'
    expect(parseStreamingMessage(input)).toBe('path\\to')
  })

  test('returns trimmed input when message key not present', () => {
    // If it starts with { but doesn't have "message", return trimmed input
    const input = '{"mess'
    expect(parseStreamingMessage(input)).toBe('{"mess')
  })

  test('returns trimmed input when message key not fully present', () => {
    // "message" is present but no value yet - still returns trimmed input
    // because the check requires startsWith('{') AND includes('"message"')
    const input = '{"message'
    expect(parseStreamingMessage(input)).toBe('{"message')
  })

  test('returns empty string when no opening quote for value', () => {
    // Has "message" but no quote after colon yet
    const input = '{"message":'
    expect(parseStreamingMessage(input)).toBe('')
  })

  test('returns plain text for non-JSON input', () => {
    const input = 'Just streaming plain text'
    expect(parseStreamingMessage(input)).toBe('Just streaming plain text')
  })

  test('handles empty input', () => {
    expect(parseStreamingMessage('')).toBe('')
  })

  test('trims whitespace', () => {
    expect(parseStreamingMessage('  plain text  ')).toBe('plain text')
  })
})

test.describe('unescapeJsonString', () => {
  test('unescapes double quotes', () => {
    expect(unescapeJsonString('He said \\"hello\\"')).toBe('He said "hello"')
  })

  test('unescapes newlines', () => {
    expect(unescapeJsonString('Line 1\\nLine 2')).toBe('Line 1\nLine 2')
  })

  test('unescapes tabs', () => {
    expect(unescapeJsonString('Col1\\tCol2')).toBe('Col1\tCol2')
  })

  test('unescapes carriage returns', () => {
    expect(unescapeJsonString('Line 1\\rLine 2')).toBe('Line 1\rLine 2')
  })

  test('unescapes backslashes', () => {
    expect(unescapeJsonString('C:\\\\Users\\\\test')).toBe('C:\\Users\\test')
  })

  test('handles mixed escapes', () => {
    const input = 'Line 1\\nHe said \\"hi\\"\\tand left'
    expect(unescapeJsonString(input)).toBe('Line 1\nHe said "hi"\tand left')
  })

  test('handles empty string', () => {
    expect(unescapeJsonString('')).toBe('')
  })

  test('leaves unescaped text unchanged', () => {
    expect(unescapeJsonString('No escapes here')).toBe('No escapes here')
  })
})

test.describe('stripCiteTags', () => {
  test('removes cite tags', () => {
    const input = 'Some text<cite source="example.com">1</cite> more text'
    expect(stripCiteTags(input)).toBe('Some text more text')
  })

  test('removes multiple cite tags', () => {
    const input = 'First<cite>1</cite> second<cite>2</cite> third'
    expect(stripCiteTags(input)).toBe('First second third')
  })

  test('handles cite tags with attributes', () => {
    const input = 'Text<cite id="1" class="ref" data-source="test">content</cite>end'
    expect(stripCiteTags(input)).toBe('Textend')
  })

  test('handles self-closing-like cite tags', () => {
    const input = 'Text<cite></cite>end'
    expect(stripCiteTags(input)).toBe('Textend')
  })

  test('trims result', () => {
    const input = '  <cite>1</cite>  '
    expect(stripCiteTags(input)).toBe('')
  })

  test('handles empty string', () => {
    expect(stripCiteTags('')).toBe('')
  })

  test('leaves text without cite tags unchanged', () => {
    expect(stripCiteTags('No citations here')).toBe('No citations here')
  })
})

test.describe('cleanAIMessage', () => {
  test('parses JSON and strips cite tags', () => {
    const input = '{"message":"Check this<cite>1</cite> out","actions":[]}'
    expect(cleanAIMessage(input)).toBe('Check this out')
  })

  test('handles plain text with cite tags', () => {
    const input = 'Plain<cite source="x">ref</cite> text'
    expect(cleanAIMessage(input)).toBe('Plain text')
  })

  test('handles JSON with escape sequences and cite tags', () => {
    const input = '{"message":"Line 1\\nLine 2<cite>1</cite>","actions":[]}'
    expect(cleanAIMessage(input)).toBe('Line 1\nLine 2')
  })

  test('handles empty input', () => {
    expect(cleanAIMessage('')).toBe('')
  })
})

test.describe('real-world scenarios', () => {
  test('handles typical chat response', () => {
    const input = `{"message":"To renew your passport, you'll need to:\\n\\n1. Fill out Form DS-82\\n2. Get a new passport photo\\n3. Mail the application\\n\\nThe process takes 8-11 weeks.","actions":[{"type":"show_sources","label":"View sources"}]}`

    const result = parseAIResponseFull(input)

    expect(result.message).toContain('Form DS-82')
    expect(result.message).toContain('\n')
    expect(result.actions).toHaveLength(1)
  })

  test('handles step completion action', () => {
    const input = '{"message":"Great job! I marked that step as complete.","actions":[{"type":"mark_step_done","stepId":"step-123","label":"Step completed"}]}'

    const result = parseAIResponseFull(input)

    expect(result.message).toBe('Great job! I marked that step as complete.')
    expect(result.actions[0].type).toBe('mark_step_done')
    expect(result.actions[0].stepId).toBe('step-123')
  })

  test('handles streaming progress', () => {
    // Simulate incremental streaming
    // Early chunks without "message" return the input trimmed
    // Once we have "message" and a value, we extract it

    // Before "message" key is complete - returns trimmed input
    expect(parseStreamingMessage('{"m')).toBe('{"m')
    expect(parseStreamingMessage('{"mes')).toBe('{"mes')

    // "message" key present but no value yet - returns empty
    expect(parseStreamingMessage('{"message":')).toBe('')
    expect(parseStreamingMessage('{"message": ')).toBe('')

    // Once we have the opening quote, we start extracting
    expect(parseStreamingMessage('{"message":"')).toBe('')
    expect(parseStreamingMessage('{"message":"W')).toBe('W')
    expect(parseStreamingMessage('{"message":"Working')).toBe('Working')
    expect(parseStreamingMessage('{"message":"Working on it')).toBe('Working on it')

    // Complete value (with closing quote)
    expect(parseStreamingMessage('{"message":"Working on it..."')).toBe('Working on it...')

    // After actions start
    expect(parseStreamingMessage('{"message":"Working on it...","actions')).toBe('Working on it...')

    // Complete JSON
    expect(parseStreamingMessage('{"message":"Working on it...","actions":[]}')).toBe('Working on it...')
  })

  test('handles AI response with citations', () => {
    const input = '{"message":"The deadline is May 3rd<cite source=\\"state.gov\\">1</cite>. Make sure to apply early<cite>2</cite>.","actions":[]}'

    const cleaned = cleanAIMessage(input)

    expect(cleaned).toBe('The deadline is May 3rd. Make sure to apply early.')
    expect(cleaned).not.toContain('<cite')
  })
})

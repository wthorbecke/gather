import { NextResponse } from 'next/server'
import { splitStepText } from '@/lib/stepText'
import { prioritizeSources, scoreSource, isLowQualitySource, isNewsSource } from '@/lib/sourceQuality'
import { normalizeActionUrl } from '@/config/content'
import { AI_MODELS, AI_MAX_TOKENS } from '@/config/ai'

interface ClarifyingAnswer {
  question: string
  answer: string
}

// v17 Rich Step interface
interface RichStep {
  text: string
  summary?: string
  detail?: string
  alternatives?: string[]
  examples?: string[]
  checklist?: string[]
  time?: string
  source?: { name: string; url: string }
  action?: { text: string; url: string }
}

interface SearchSource {
  title: string
  url: string
}

interface SearchResult {
  text: string
  sources: SearchSource[]
}

// Search the web using Tavily - returns formatted text AND extracted sources
async function searchWeb(query: string): Promise<SearchResult> {
  const tavilyKey = process.env.TAVILY_API_KEY
  if (!tavilyKey) {
    return { text: 'Web search not available', sources: [] }
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
    })

    if (!response.ok) {
      return { text: 'Search failed', sources: [] }
    }

    const data = await response.json()
    const sources: SearchSource[] = []

    // Format results for Claude
    let results = ''
    if (data.answer) {
      results += `Summary: ${data.answer}\n\n`
    }
    if (data.results) {
      const rankedResults = [...data.results].sort((a, b) => scoreSource(b.url) - scoreSource(a.url))
      const rankedSources = prioritizeSources(
        rankedResults.map((r) => ({ title: r.title, url: r.url }))
      )
      const allowedUrls = new Set(rankedSources.map((s) => s.url))
      const filteredResults = rankedResults.filter((r) => allowedUrls.has(r.url)).slice(0, 5)

      results += 'Sources:\n'
      for (const r of filteredResults) {
        // Extract domain name for cleaner source display
        let sourceName = r.title
        try {
          const url = new URL(r.url)
          // Use domain as source name if title is too long
          if (r.title.length > 50) {
            sourceName = url.hostname.replace('www.', '')
          }
        } catch { /* keep original title */ }

        sources.push({ title: sourceName, url: r.url })
        results += `- ${r.title}: ${r.url}\n  ${r.content?.slice(0, 200)}...\n`
      }
    }
    return { text: results || 'No results found', sources }
  } catch (error) {
    console.error('Tavily search error:', error)
    return { text: 'Search failed', sources: [] }
  }
}

// Generate contextual fallback steps when AI fails
function generateFallbackSteps(title: string) {
  const taskLower = title.toLowerCase()

  if (taskLower.includes('cancel')) {
    return [
      { text: `Find ${title.split(' ').slice(-1)[0] || 'the service'} contact info (account page or Google "[company] cancel")`, summary: 'Locate cancellation method', time: '5 min' },
      { text: 'Call or use online chat - say "I want to cancel my account"', summary: 'Direct request works best', time: '10 min' },
      { text: 'Get confirmation number or email and save it', summary: 'Proof of cancellation', time: '2 min' },
    ]
  } else if (taskLower.includes('learn') || taskLower.includes('practice') || taskLower.includes('study')) {
    return [
      { text: 'Decide on one specific skill to focus on this week', summary: 'Narrow focus = faster progress', time: '5 min' },
      { text: 'Do 20 minutes of deliberate practice (not just going through motions)', summary: 'Quality over quantity', time: '20 min' },
      { text: 'Note what felt hard and what clicked', summary: 'Builds self-awareness', time: '5 min' },
      { text: 'Stop here for today - schedule next session', summary: 'Consistency beats intensity', time: '2 min' },
    ]
  } else if (taskLower.includes('write') || taskLower.includes('draft') || taskLower.includes('create')) {
    return [
      { text: 'Write down 5 bullet points of what you want to say (messy is fine)', summary: 'Raw material first', time: '10 min' },
      { text: 'Turn 2-3 bullets into full sentences', summary: 'Just get words down', time: '15 min' },
      { text: 'Read it out loud and fix anything that sounds weird', summary: 'Your ear catches what eyes miss', time: '10 min' },
      { text: 'Stop here - revisit tomorrow with fresh eyes', summary: 'Distance improves editing', time: '1 min' },
    ]
  } else if (taskLower.includes('appointment') || taskLower.includes('schedule') || taskLower.includes('book')) {
    return [
      { text: `Search "[${title}] online booking" or find the phone number`, summary: 'Find booking method', time: '5 min' },
      { text: 'Check your calendar for 2-3 possible times', summary: 'Be ready with options', time: '3 min' },
      { text: 'Book the appointment and add it to your calendar immediately', summary: 'Lock it in', time: '5 min' },
      { text: 'Set a reminder for the day before', summary: 'Avoid no-shows', time: '1 min' },
    ]
  } else if (taskLower.includes('email') || taskLower.includes('message') || taskLower.includes('contact')) {
    return [
      { text: 'Write the main point you want to make in one sentence', summary: 'Clarity first', time: '3 min' },
      { text: 'Add any necessary context (but keep it short)', summary: 'Respect their time', time: '5 min' },
      { text: 'Read it once, fix obvious issues, then send', summary: 'Done beats perfect', time: '3 min' },
    ]
  } else {
    return [
      { text: `Search "[${title}] how to" and open the top 2 results`, summary: 'Find the actual process', time: '5 min' },
      { text: 'Write down the 3 main things you need to do', summary: 'Capture the key steps', time: '5 min' },
      { text: 'Do the first thing on your list right now', summary: 'Momentum matters most', time: '15 min' },
      { text: 'Come back and tell me how it went - I can help refine', summary: 'Iterate together', time: '2 min' },
    ]
  }
}

export async function POST(request: Request) {
  try {
    const { title, description, notes, existingSubtasks, clarifyingAnswers, taskCategory } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const existingContext = existingSubtasks?.length > 0
      ? '\n\nAlready added steps:\n' + existingSubtasks.map((s: string) => '- ' + s).join('\n')
      : ''

    // Build context from clarifying answers
    const clarifyingContext = clarifyingAnswers?.length > 0
      ? '\n\nContext from user:\n' + clarifyingAnswers.map((qa: ClarifyingAnswer) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : ''

    const systemPrompt = `You help someone with ADHD complete tasks. Generate specific, actionable steps.

## TASK TYPE ADAPTATION
Detect the task type and adjust your approach:

BUREAUCRATIC (forms, cancellations, appointments):
- USE web search to find exact URLs, phone numbers, fees, requirements
- Every step needs specifics: what form, what number, what to bring
- Include official sources for each step

PERSONAL/SOCIAL (parties, gifts, events for specific people):
- THIS IS THE MOST IMPORTANT TYPE TO GET RIGHT
- Steps MUST use the actual names provided in context
- Steps MUST include draft messages ready to send
- Steps SHOULD include specific local recommendations (use web search for "{city} {type of place}")
- Steps SHOULD include estimated costs
- Steps SHOULD include links to specific products/places

EXAMPLE - "Plan birthday party for Alex" with context "casual vibe, 8-10 people, $200 budget, vegetarian":
GOOD STEPS:
1. "Text the crew - draft: 'Hey! Planning a chill birthday hangout for Alex on [date], you in?'"
   - Detail: Send to Sarah, Mike, Jordan (Alex's closest friends)
   - Time: 5 min
2. "Order from [Local Pizza Place] - get 2 large veggie pizzas + 1 cheese (~$50)"
   - Detail: Alex loves their margherita. Order by 2pm for 6pm delivery.
   - Action: {text: "Order online", url: "[actual restaurant URL]"}
   - Time: 10 min
3. "Get cake from [Local Bakery] - chocolate layer cake feeds 10 (~$45)"
   - Detail: Call to order, pickup day-of. Ask for "Happy Birthday Alex" writing.
   - Action: {text: "Call bakery", url: "tel:555-1234"}
   - Time: 5 min
4. "Amazon order: balloons, banner, candles (~$25)"
   - Action: {text: "Quick party supplies", url: "amazon.com search link"}
   - Time: 10 min
5. "Day before: confirm headcount, set up playlist Alex would like"
   - Time: 15 min

BAD STEPS (never generate these for personal tasks):
- "Create guest list" - too vague, should have names
- "Plan food" - should have specific places and items
- "Buy decorations" - should have specific items and where to get them
- "Send invitations" - should include actual draft text

LEARNING (skills, practice, study):
- NO web search needed - focus on practice structure
- Steps should be timed practice sessions with clear focus
- Include "what good looks like" guidance

CREATIVE (writing, art, planning):
- NO web search needed - focus on process
- Start with brainstorming/raw material steps
- Include revision/iteration steps
- Add "rest and return" step for quality

HABIT (recurring behaviors):
- Focus on the smallest possible start
- Include trigger/cue identification
- Build in consistency over intensity

PROJECT (multi-phase, complex):
- Break into distinct phases
- Each phase should have a clear deliverable
- Keep to 5-8 steps maximum

SIMPLE/QUICK (emails, calls, small purchases, quick tasks):
- 3 steps MAX - do not over-engineer simple tasks
- Skip obvious steps like "open email" or "go to website"
- Focus on the THINKING part, not the mechanics
- Example for "email boss about Friday off":
  1. "Decide your reason and what coverage you need" (3 min)
  2. "Write a 2-3 sentence request - be direct" (5 min)
  3. "Send it and add 'await reply' to your task list" (1 min)
- NEVER generate steps like "Open your email app" or "Click compose"

## STEP RULES

GOOD STEPS (be like these):
- "Go to dmv.ca.gov/realid and click 'Start Application'" (specific URL, specific action)
- "Call 1-800-555-1234 and say: 'I need to cancel account #12345'" (exact script)
- "Write 5 memories of [person] in bullet points, 1-2 sentences each" (clear scope)
- "Practice scales for 10 minutes at 60 BPM, then increase to 80 BPM" (measurable)

BAD STEPS (never generate these):
- "Research the requirements" → Instead: specific URL or "Search '[exact query]' and note..."
- "Contact customer service" → Instead: phone number + what to say
- "Gather documents" → Instead: list the exact documents
- "Fill out the form" → Instead: which form, where to get it, key fields
- "Wait for response" → Skip entirely or give timeline + what to do if no response
- "Open your email" / "Click compose" / "Address the email" → Too obvious, skip mechanical steps
- "Go to the website" → Instead: specific URL + what to click there
- "Create a guest list" → Instead: "Text [names] - draft: '[actual message]'"
- "Plan the food" → Instead: "Order from [specific place] - [specific items] (~$X)"
- "Buy decorations" → Instead: "Amazon: balloons, banner (~$X)" with action link
- "Pick a date" → Instead: "Text [name] 'Are you free on [date]?'"
- "Choose a venue" → Instead: Name the venue or give 2-3 specific options with why

## STEP COUNT GUIDANCE
- Quick tasks: 3-4 steps
- Standard tasks: 4-6 steps
- Complex/multi-phase: 6-10 steps broken into phases
- Never fewer than 3 steps (unless truly trivial)
- Never more than 10 steps (break into sub-tasks instead)

## SOURCES
- BUREAUCRATIC: Required - find official .gov/.edu/.org sources
- LEARNING: Optional - only if there's a genuinely useful resource
- CREATIVE: Rarely needed - focus on process
- If no good source exists, OMIT the source field entirely
- NEVER fabricate URLs, phone numbers, or fees

## ADHD SUPPORT (apply to all tasks)
- First step: something completable in under 5 minutes
- Time estimate on EVERY step
- Prefer "pick one and go" over "consider your options"
- Make decisions for the user when reasonable
- Keep list to 4-6 actionable steps (no filler)

## OUTPUT FORMAT
Return ONLY a JSON array:
[
  {
    "text": "Main step instruction - specific and actionable",
    "summary": "5-10 words on why this matters",
    "detail": "Optional: expanded instructions if the step is complex",
    "time": "X min",
    "source": {"name": "Official Source", "url": "https://..."},
    "action": {"text": "Button text", "url": "https://direct-link"}
  }
]

CRITICAL:
- Return ONLY the JSON array
- No markdown, no explanation, no apologies
- If search fails, still return useful process-based steps
- Omit source/action fields if not applicable
- NEVER return generic placeholder steps`

    const userPrompt = `Task: ${title}
${description ? 'Description: ' + description : ''}
${notes ? 'Notes: ' + notes : ''}${clarifyingContext}${existingContext}

Return a JSON array of 3-6 specific, actionable steps. Include text, summary, and any relevant details. ONLY output the JSON array, nothing else.`

    // Define the search tool
    const tools = [
      {
        name: 'web_search',
        description: 'Search the web for current information. Use this to find official requirements, URLs, forms, costs, and processes.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query. Be specific, e.g., "California REAL ID requirements 2024" or "California DMV appointment scheduling"',
            },
          },
          required: ['query'],
        },
      },
    ]

    // First call - Claude may request tool use
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.taskBreakdown,
        max_tokens: 1500,
        system: systemPrompt,
        tools,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    let data = await response.json()
    
    // Handle tool use - Claude may want to search
    const messages: Array<{role: string, content: unknown}> = [{ role: 'user', content: userPrompt }]
    const collectedSources: SearchSource[] = []

    while (data.stop_reason === 'tool_use') {
      const assistantContent = data.content
      messages.push({ role: 'assistant', content: assistantContent })

      // Process tool calls
      const toolResults = []
      for (const block of assistantContent) {
        if (block.type === 'tool_use' && block.name === 'web_search') {
          console.log('Searching:', block.input.query)
          const searchResult = await searchWeb(block.input.query)
          // Collect sources for reference
          collectedSources.push(...searchResult.sources)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: searchResult.text,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
      
      // Continue the conversation
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: AI_MODELS.taskBreakdown,
          max_tokens: 1500,
          system: systemPrompt,
          tools,
          messages,
        }),
      })
      
      data = await response.json()
    }

    // Extract the final text response
    if (!data.content) {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    // Find the text block in the response
    const textBlock = data.content.find((block: {type: string}) => block.type === 'text')
    if (!textBlock) {
      return NextResponse.json({ error: 'No text response' }, { status: 500 })
    }

    const text = textBlock.text
    console.log('AI response text:', text.substring(0, 500))

    // Parse the JSON array from the response - handle markdown code blocks
    let jsonText = text

    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
    }

    // Find JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Could not find JSON array in:', jsonText.substring(0, 300))
      return NextResponse.json({ subtasks: generateFallbackSteps(title) })
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Text:', jsonMatch[0].substring(0, 200))
      return NextResponse.json({ subtasks: generateFallbackSteps(title) })
    }

    const prioritizedSources = prioritizeSources(collectedSources)

    // Normalize to rich step format - handle both string[] and RichStep[]
    const splitVerboseTitle = (step: RichStep): RichStep => {
      const { title, remainder } = splitStepText(step.text)
      if (!remainder || !title || title === step.text) return step
      if (step.summary) {
        return {
          ...step,
          text: title,
          detail: step.detail ? `${step.detail} ${remainder}` : remainder,
        }
      }
      return {
        ...step,
        text: title,
        summary: remainder,
      }
    }

    const steps: RichStep[] = parsed.map((item: string | RichStep, index: number) => {
      if (typeof item === 'string') {
        item = { text: item }
      }
      item = splitVerboseTitle(item)
      // Remove low-quality or news sources
      if (item.source?.url && (isLowQualitySource(item.source.url) || isNewsSource(item.source.url))) {
        item = { ...item, source: undefined }
      }
      // Only add collected sources if the step actually references web-searched content
      // Don't auto-assign sources to steps that don't need them (like "text your friends")
      // The AI should include source in its JSON output when appropriate
      // If action is a direct file (e.g., PDF) and source matches it, prefer a broader info source
      if (item.action?.url && item.source?.url) {
        const actionUrl = item.action.url
        const sourceUrl = item.source.url
        const isDirectFile = /\.(pdf|docx?|xlsx?|pptx?)($|[?#])/i.test(actionUrl)
        if (isDirectFile && actionUrl === sourceUrl && prioritizedSources.length > 0) {
          const alternative = prioritizedSources.find((s) => s.url !== actionUrl)
          if (alternative) {
            item = {
              ...item,
              source: { name: alternative.title, url: alternative.url },
            }
          }
        }
      }
      // Normalize known DMV REAL ID application links to the direct application start
      if (item.action?.url && item.action?.text) {
        const actionUrl = item.action.url
        const actionText = item.action.text
        item = {
          ...item,
          action: {
            text: actionText,
            url: normalizeActionUrl(actionUrl),
          },
        }
      }
      return item
    })

    return NextResponse.json({ subtasks: steps, sources: prioritizedSources })
  } catch (error) {
    console.error('Error generating subtasks:', error)
    return NextResponse.json({ error: 'Failed to generate subtasks' }, { status: 500 })
  }
}

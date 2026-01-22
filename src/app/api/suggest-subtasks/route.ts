import { NextResponse } from 'next/server'

interface ClarifyingAnswer {
  question: string
  answer: string
}

// Search the web using Tavily
async function searchWeb(query: string): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY
  if (!tavilyKey) {
    return 'Web search not available'
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
      return 'Search failed'
    }

    const data = await response.json()
    
    // Format results for Claude
    let results = ''
    if (data.answer) {
      results += `Summary: ${data.answer}\n\n`
    }
    if (data.results) {
      results += 'Sources:\n'
      for (const r of data.results.slice(0, 3)) {
        results += `- ${r.title}: ${r.url}\n  ${r.content?.slice(0, 200)}...\n`
      }
    }
    return results || 'No results found'
  } catch (error) {
    console.error('Tavily search error:', error)
    return 'Search failed'
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

    const systemPrompt = `You're an expert assistant helping someone with ADHD complete a task. You have web search - use it to do the research FOR them, not to tell them to do research.

You have a web_search tool. USE IT to find:
- Exact URLs to forms, applications, appointment schedulers
- Current costs/fees (give exact numbers, not ranges)
- Specific requirements and documents needed

YOUR JOB IS TO DO THE WORK. The user should NOT have to:
- "Visit website to verify" anything - YOU verify it
- "Check the website for" anything - YOU check it
- Look up forms - YOU find the direct link
- Find appointment pages - YOU find the exact URL

GOOD subtasks:
- "Gather: Birth certificate"
- "Fill out DL 44 form: https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/"
- "Schedule appointment: https://www.dmv.ca.gov/portal/appointments/select-appointment-type/"
- "Pay $39 fee at appointment"

BAD subtasks (NEVER DO THESE):
- "Visit website to verify requirements" - NO, you tell them the requirements
- "Check website for current fees" - NO, you tell them the fee
- "Download form from website" - NO, give the direct link
- "Arrive at appointment with documents" - NO, this is obvious
- "Wait for card to arrive in mail" - NO, this is obvious

Only include PREPARATION steps - things they need to DO before the appointment/submission. Don't include obvious "day of" or "after" steps.

FOLLOW-UPS: If the task involves scheduling something, include ONE follow-up reminder as the last step:
- Format: "Reminder: [what to remember] (after scheduling)"
- Example: "Reminder: DMV appointment - bring all documents (after scheduling)"
This tells the user they'll want to set a reminder once they've scheduled.

After searching, respond with ONLY a JSON array of action steps.`

    const userPrompt = `Task: ${title}
${description ? 'Description: ' + description : ''}
${notes ? 'Notes: ' + notes : ''}${clarifyingContext}${existingContext}

Search to find EXACT URLs and EXACT costs. Then give me a JSON array of specific action steps. Remember: do the research work for me, give me direct links, and skip obvious steps.`

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        tools,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    let data = await response.json()
    
    // Handle tool use - Claude may want to search
    const messages: Array<{role: string, content: unknown}> = [{ role: 'user', content: userPrompt }]
    
    while (data.stop_reason === 'tool_use') {
      const assistantContent = data.content
      messages.push({ role: 'assistant', content: assistantContent })
      
      // Process tool calls
      const toolResults = []
      for (const block of assistantContent) {
        if (block.type === 'tool_use' && block.name === 'web_search') {
          console.log('Searching:', block.input.query)
          const searchResult = await searchWeb(block.input.query)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: searchResult,
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
          model: 'claude-sonnet-4-20250514',
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

    // Parse the JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse response' }, { status: 500 })
    }

    const subtasks = JSON.parse(jsonMatch[0])
    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error('Error generating subtasks:', error)
    return NextResponse.json({ error: 'Failed to generate subtasks' }, { status: 500 })
  }
}

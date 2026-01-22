import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, context, history } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // Build messages array with history
    const messages = [
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: `Context about my situation: ${context}

My question: ${message}

Please give me specific, actionable steps. Include real phone numbers, websites, and exact language to use if relevant. Search the web if you need current information. Be direct and helpful — I'm dealing with ADHD and need clear, concrete guidance, not vague advice.`,
      },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        system: `You are a helpful assistant integrated into Gather, an app designed for people with ADHD and executive function challenges. Your role is to:

1. Break down complex tasks into simple, concrete steps
2. Find specific information (phone numbers, websites, exact procedures)
3. Write scripts and templates the user can copy-paste
4. Be direct and compassionate — no corporate wellness language
5. Search the web when you need current or specific information

Speak like a trusted friend who's helping someone get through their admin tasks. Be warm but efficient. Don't pad your responses with unnecessary caveats or disclaimers.`,
        messages,
      }),
    })

    const data = await response.json()

    // Extract text from response
    let responseText = ''
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
      }
    }

    return NextResponse.json({ response: responseText || 'Sorry, I couldn\'t generate a response.' })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { title } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const prompt = `You're helping someone with ADHD capture a task. They just typed: "${title}"

Your job: Figure out if you need any clarifying info to give them a great action plan. Ask ONLY questions that will meaningfully change your recommendations.

Think about what context would actually help you give better, more specific advice:
- Location/state if requirements vary by location
- Current status (e.g., new vs renewal, do they already have X)
- Timeline/urgency if it affects the approach
- Key details that determine the process

But DON'T ask unnecessary questions:
- If the task is simple and clear, don't ask anything
- Don't ask questions just to seem thorough
- Don't ask for info you don't actually need

Respond with ONLY valid JSON:
{
  "needsClarification": true/false,
  "taskCategory": "government|medical|financial|travel|home|work|errand|personal|other",
  "questions": [
    {
      "id": "q1",
      "question": "Short, direct question",
      "why": "One sentence on why this matters for your advice",
      "options": ["Option 1", "Option 2", "Option 3"] or null for free text
    }
  ],
  "immediateInsight": "Something genuinely useful you notice about this task, or null if nothing notable"
}

Rules:
- Max 2-3 questions, only if they'll change your advice
- Simple tasks (buy milk, send email) → needsClarification: false
- Options should be practical choices, not exhaustive lists
- immediateInsight should be actually helpful, not generic encouragement`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const data = await response.json()

    if (!data.content || !data.content[0]) {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const text = data.content[0].text

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse response' }, { status: 500 })
    }

    const analysis = JSON.parse(jsonMatch[0])
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error analyzing task:', error)
    return NextResponse.json({ error: 'Failed to analyze task' }, { status: 500 })
  }
}

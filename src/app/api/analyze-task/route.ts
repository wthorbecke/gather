import { NextResponse } from 'next/server'
import { AI_MODELS } from '@/config/ai'

export async function POST(request: Request) {
  try {
    const { title } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const now = new Date()
    const prompt = `You're helping someone with ADHD capture a task. Current date: ${now.toISOString()}. They just typed: "${title}"

Your job: Do a quick task-type classification and decide if you need clarifying info to give a great action plan. Ask ONLY questions that will meaningfully change your recommendations.

Think about what context would actually help you give better, more specific advice:
- Location/state if requirements vary by location
- Current status (e.g., new vs renewal, do they already have X)
- Timeline/urgency if it affects the approach
- Key details that determine the process
- For learning: current level + time per week + focus area
- For creative: audience + tone + deliverable format
- For habits: frequency + time of day + barriers
- For multi-phase: dates + budget + constraints

But DON'T ask unnecessary questions:
- If the task is simple and clear, don't ask anything
- Don't ask questions just to seem thorough
- Don't ask for info you don't actually need

Respond with ONLY valid JSON:
{
  "needsClarification": true/false,
  "taskType": "bureaucratic|learning|creative|habit|multi_phase|vague_goal|other",
  "taskCategory": "government|medical|financial|travel|home|work|errand|personal|other",
  "questions": [
    {
      "id": "q1",
      "question": "Short, direct question",
      "why": "One sentence on why this matters for your advice",
      "options": ["Option 1", "Option 2", "Option 3"] or null for free text
    }
  ],
  "deadline": {
    "date": "YYYY-MM-DD" or null,
    "type": "hard|soft|flexible",
    "source": "explicit (user stated) | inferred (common deadline) | none",
    "note": "Why this deadline matters, or null"
  },
  "immediateInsight": "Something genuinely useful you notice about this task, or null if nothing notable"
}

Deadline detection:
- "hard" = real consequences (fees, expiration, legal)
- "soft" = preferred but movable (appointments, goals)
- "flexible" = nice-to-have timeline
- Extract explicit dates ("by Friday", "before Dec 31")
- Infer common deadlines (tax deadline = April 15, passport renewal = 6 months before travel)
- If no deadline mentioned or inferred, date: null

Rules:
- Max 2-3 questions, only if they'll change your advice
- Simple tasks (buy milk, send email) → needsClarification: false
- Options should be practical choices, not exhaustive lists
- immediateInsight should be actually helpful, not generic encouragement
- If you include any year in options (deadlines, tax years, etc.), do not invent past years. Use the current year and next year if needed unless the user explicitly referenced past years.
- If the user says they missed prior years, ask which years or include only the years they provided.
- If you mention "end of year," make the year explicit (e.g., "by the end of 2026").`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.taskAnalysis,
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

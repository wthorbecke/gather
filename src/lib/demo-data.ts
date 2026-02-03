/**
 * Mock data for demo mode
 * Provides realistic email and calendar data so users can experience full functionality
 */

export interface MockEmail {
  id: string
  subject: string
  from: string
  snippet: string
}

export interface MockCalendarEvent {
  id: string
  title: string
  start_time: string
  location?: string
}

// Realistic emails that represent common actionable items
export const DEMO_EMAILS: MockEmail[] = [
  {
    id: 'demo-email-1',
    subject: 'Your car registration expires in 2 weeks',
    from: 'DMV Notifications',
    snippet: 'Your vehicle registration for plate ABC-1234 expires on...',
  },
  {
    id: 'demo-email-2',
    subject: 'Dentist appointment reminder',
    from: 'Smile Dental Care',
    snippet: 'This is a reminder that you have an appointment scheduled for...',
  },
  {
    id: 'demo-email-3',
    subject: 'Your prescription is ready for pickup',
    from: 'CVS Pharmacy',
    snippet: 'Your prescription for... is ready at the CVS located at...',
  },
  {
    id: 'demo-email-4',
    subject: 'Invoice #4521 - Payment due',
    from: 'Utility Company',
    snippet: 'Your monthly bill of $127.50 is due on...',
  },
]

// Get demo calendar events with dynamic times relative to now
// Events are always scheduled in the future to look realistic
export function getDemoCalendarEvents(): MockCalendarEvent[] {
  const now = new Date()

  // Round to next half hour for cleaner display
  const roundToNextHalfHour = (date: Date): Date => {
    const d = new Date(date)
    const minutes = d.getMinutes()
    if (minutes < 30) {
      d.setMinutes(30, 0, 0)
    } else {
      d.setHours(d.getHours() + 1, 0, 0, 0)
    }
    return d
  }

  // Event 1: 1 hour from now
  const meeting1 = new Date(roundToNextHalfHour(now))
  meeting1.setMinutes(meeting1.getMinutes() + 60)

  // Event 2: 3 hours from now
  const meeting2 = new Date(roundToNextHalfHour(now))
  meeting2.setMinutes(meeting2.getMinutes() + 180)

  // Event 3: Tomorrow at 10 AM
  const meeting3 = new Date(now)
  meeting3.setDate(meeting3.getDate() + 1)
  meeting3.setHours(10, 0, 0, 0)

  return [
    {
      id: 'demo-cal-1',
      title: 'Team standup',
      start_time: meeting1.toISOString(),
      location: 'Zoom',
    },
    {
      id: 'demo-cal-2',
      title: 'Coffee with Alex',
      start_time: meeting2.toISOString(),
      location: 'Blue Bottle Coffee',
    },
    {
      id: 'demo-cal-3',
      title: 'Quarterly planning',
      start_time: meeting3.toISOString(),
      location: 'Conference Room B',
    },
  ]
}

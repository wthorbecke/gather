import { Step } from '@/hooks/useUserData'

export interface TaskTemplate {
  id: string
  title: string
  description: string
  icon: string  // emoji for visual recognition
  category: 'productivity' | 'self-care' | 'home' | 'work' | 'health'
  steps: Step[]
}

// Pre-built task templates for common tasks
// These reduce friction and AI calls for repetitive workflows
export const taskTemplates: TaskTemplate[] = [
  // PRODUCTIVITY
  {
    id: 'weekly-review',
    title: 'Weekly review',
    description: 'Reflect on the week and plan ahead',
    icon: '📋',
    category: 'productivity',
    steps: [
      {
        id: 'step-1',
        text: 'Clear your inbox to zero (or close to it)',
        done: false,
        summary: 'Process emails, archive or respond',
        time: '15 min',
      },
      {
        id: 'step-2',
        text: 'Review completed tasks from this week',
        done: false,
        summary: 'Celebrate wins and note what worked',
        time: '5 min',
      },
      {
        id: 'step-3',
        text: 'Review incomplete tasks and decide: do, defer, or delete',
        done: false,
        summary: 'Be honest about what you\'ll actually do',
        time: '10 min',
      },
      {
        id: 'step-4',
        text: 'Check your calendar for next week',
        done: false,
        summary: 'Note conflicts and prep needed',
        time: '5 min',
      },
      {
        id: 'step-5',
        text: 'Pick your top 3 priorities for next week',
        done: false,
        summary: 'Focus on what matters most',
        time: '5 min',
      },
    ],
  },
  {
    id: 'morning-routine',
    title: 'Morning routine',
    description: 'Start your day right',
    icon: '🌅',
    category: 'productivity',
    steps: [
      {
        id: 'step-1',
        text: 'Make your bed',
        done: false,
        summary: 'Small win to start the day',
        time: '2 min',
      },
      {
        id: 'step-2',
        text: 'Drink a glass of water',
        done: false,
        summary: 'Rehydrate after sleep',
        time: '1 min',
      },
      {
        id: 'step-3',
        text: 'Quick stretch or movement (5 minutes)',
        done: false,
        summary: 'Wake up your body',
        time: '5 min',
      },
      {
        id: 'step-4',
        text: 'Review your day\'s tasks',
        done: false,
        summary: 'Know what you need to focus on',
        time: '5 min',
      },
      {
        id: 'step-5',
        text: 'Start on your most important task',
        done: false,
        summary: 'Tackle the hard thing while fresh',
        time: '30 min',
      },
    ],
  },
  {
    id: 'brain-dump',
    title: 'Brain dump',
    description: 'Get everything out of your head',
    icon: '🧠',
    category: 'productivity',
    steps: [
      {
        id: 'step-1',
        text: 'Set a timer for 10 minutes',
        done: false,
        summary: 'Timeboxing helps you focus',
        time: '1 min',
      },
      {
        id: 'step-2',
        text: 'Write down everything on your mind',
        done: false,
        summary: 'Tasks, worries, ideas - don\'t filter',
        time: '10 min',
      },
      {
        id: 'step-3',
        text: 'Circle the actionable items',
        done: false,
        summary: 'Things you can actually do something about',
        time: '3 min',
      },
      {
        id: 'step-4',
        text: 'Add actionable items to your task list',
        done: false,
        summary: 'Get them into a trusted system',
        time: '5 min',
      },
      {
        id: 'step-5',
        text: 'Review non-actionable items - journal or let go',
        done: false,
        summary: 'Process worries by acknowledging them',
        time: '5 min',
      },
    ],
  },

  // SELF-CARE
  {
    id: 'wind-down',
    title: 'Wind down routine',
    description: 'Prepare for restful sleep',
    icon: '🌙',
    category: 'self-care',
    steps: [
      {
        id: 'step-1',
        text: 'Put phone on charger away from bed',
        done: false,
        summary: 'Remove the temptation to scroll',
        time: '1 min',
      },
      {
        id: 'step-2',
        text: 'Write tomorrow\'s top 3 priorities',
        done: false,
        summary: 'Clear your mind of planning',
        time: '3 min',
      },
      {
        id: 'step-3',
        text: 'Dim lights and screens',
        done: false,
        summary: 'Signal to your body it\'s time to sleep',
        time: '1 min',
      },
      {
        id: 'step-4',
        text: 'Do something relaxing (read, stretch, meditate)',
        done: false,
        summary: 'Non-screen activity for 15+ minutes',
        time: '15 min',
      },
      {
        id: 'step-5',
        text: 'Get into bed at your target time',
        done: false,
        summary: 'Consistency helps your body clock',
        time: '1 min',
      },
    ],
  },
  {
    id: 'self-care-day',
    title: 'Self-care day',
    description: 'A day focused on recharging',
    icon: '🧘',
    category: 'self-care',
    steps: [
      {
        id: 'step-1',
        text: 'Sleep in or wake up without an alarm',
        done: false,
        summary: 'Let your body rest fully',
      },
      {
        id: 'step-2',
        text: 'Take a long shower or bath',
        done: false,
        summary: 'Relaxation time',
        time: '20 min',
      },
      {
        id: 'step-3',
        text: 'Eat a proper meal you enjoy',
        done: false,
        summary: 'Nourish yourself',
        time: '30 min',
      },
      {
        id: 'step-4',
        text: 'Do something purely for enjoyment',
        done: false,
        summary: 'Read, watch, play - no productivity required',
        time: '1-2 hrs',
      },
      {
        id: 'step-5',
        text: 'Go outside for at least 15 minutes',
        done: false,
        summary: 'Fresh air and movement',
        time: '15 min',
      },
    ],
  },

  // HOME
  {
    id: 'quick-clean',
    title: 'Quick 15-minute clean',
    description: 'Fast tidy-up for unexpected guests',
    icon: '🧹',
    category: 'home',
    steps: [
      {
        id: 'step-1',
        text: 'Grab a trash bag and do a sweep of visible rooms',
        done: false,
        summary: 'Collect obvious trash',
        time: '3 min',
      },
      {
        id: 'step-2',
        text: 'Gather clutter into a "doom box" or closet',
        done: false,
        summary: 'Hide the mess to sort later',
        time: '3 min',
      },
      {
        id: 'step-3',
        text: 'Wipe down kitchen counters and sink',
        done: false,
        summary: 'Clean surfaces make a big impact',
        time: '3 min',
      },
      {
        id: 'step-4',
        text: 'Check the bathroom (toilet, sink, mirror)',
        done: false,
        summary: 'Quick wipe if needed',
        time: '3 min',
      },
      {
        id: 'step-5',
        text: 'Straighten couch cushions and visible surfaces',
        done: false,
        summary: 'Final touches',
        time: '3 min',
      },
    ],
  },
  {
    id: 'grocery-run',
    title: 'Grocery run',
    description: 'Efficient grocery shopping',
    icon: '🛒',
    category: 'home',
    steps: [
      {
        id: 'step-1',
        text: 'Check fridge and pantry for what\'s low',
        done: false,
        summary: 'Avoid buying duplicates',
        time: '5 min',
      },
      {
        id: 'step-2',
        text: 'Make a list organized by store section',
        done: false,
        summary: 'Produce, dairy, frozen, etc.',
        time: '5 min',
      },
      {
        id: 'step-3',
        text: 'Bring reusable bags',
        done: false,
        summary: 'Check by the door before leaving',
        time: '1 min',
      },
      {
        id: 'step-4',
        text: 'Shop the perimeter first (fresh foods)',
        done: false,
        summary: 'Then hit the inner aisles',
        time: '20 min',
      },
      {
        id: 'step-5',
        text: 'Put groceries away promptly when home',
        done: false,
        summary: 'Don\'t let cold items sit out',
        time: '10 min',
      },
    ],
  },

  // WORK
  {
    id: 'prepare-meeting',
    title: 'Prepare for meeting',
    description: 'Get ready for an important meeting',
    icon: '📅',
    category: 'work',
    steps: [
      {
        id: 'step-1',
        text: 'Review the meeting agenda or purpose',
        done: false,
        summary: 'Know what you\'re walking into',
        time: '5 min',
      },
      {
        id: 'step-2',
        text: 'Review any relevant documents or emails',
        done: false,
        summary: 'Be up to speed on context',
        time: '10 min',
      },
      {
        id: 'step-3',
        text: 'Write down your key points or questions',
        done: false,
        summary: 'What do you want to say or learn?',
        time: '5 min',
      },
      {
        id: 'step-4',
        text: 'Check your calendar for conflicts before/after',
        done: false,
        summary: 'Build in buffer time',
        time: '2 min',
      },
      {
        id: 'step-5',
        text: 'Test tech (video, mic, screenshare) if virtual',
        done: false,
        summary: 'Avoid first-5-minutes fumbling',
        time: '3 min',
      },
    ],
  },
  {
    id: 'end-of-day',
    title: 'End of work day',
    description: 'Wrap up and transition to personal time',
    icon: '🏠',
    category: 'work',
    steps: [
      {
        id: 'step-1',
        text: 'Write down where you left off on current project',
        done: false,
        summary: 'Future you will thank you',
        time: '3 min',
      },
      {
        id: 'step-2',
        text: 'Process your inbox - reply, archive, or defer',
        done: false,
        summary: 'Don\'t leave it for tomorrow morning',
        time: '10 min',
      },
      {
        id: 'step-3',
        text: 'Review tomorrow\'s calendar',
        done: false,
        summary: 'Know what\'s coming',
        time: '3 min',
      },
      {
        id: 'step-4',
        text: 'Set your top 3 priorities for tomorrow',
        done: false,
        summary: 'So you can start strong',
        time: '3 min',
      },
      {
        id: 'step-5',
        text: 'Close work apps and physically change location',
        done: false,
        summary: 'Create a transition ritual',
        time: '1 min',
      },
    ],
  },

  // HEALTH
  {
    id: 'doctor-visit',
    title: 'Doctor visit prep',
    description: 'Prepare for a medical appointment',
    icon: '🏥',
    category: 'health',
    steps: [
      {
        id: 'step-1',
        text: 'Write down your symptoms or concerns',
        done: false,
        summary: 'Don\'t forget anything important',
        time: '5 min',
      },
      {
        id: 'step-2',
        text: 'List current medications and dosages',
        done: false,
        summary: 'Include supplements',
        time: '5 min',
      },
      {
        id: 'step-3',
        text: 'Write down questions you want to ask',
        done: false,
        summary: 'You will forget in the moment',
        time: '5 min',
      },
      {
        id: 'step-4',
        text: 'Bring your insurance card and ID',
        done: false,
        summary: 'Check your wallet the night before',
        time: '1 min',
      },
      {
        id: 'step-5',
        text: 'Arrive 15 minutes early for paperwork',
        done: false,
        summary: 'Account for parking and check-in',
        time: '15 min',
      },
    ],
  },
  {
    id: 'workout',
    title: 'Quick workout',
    description: 'Simple exercise routine',
    icon: '💪',
    category: 'health',
    steps: [
      {
        id: 'step-1',
        text: 'Put on workout clothes and shoes',
        done: false,
        summary: 'Reduce friction to starting',
        time: '2 min',
      },
      {
        id: 'step-2',
        text: 'Warm up with light movement (jumping jacks, walking)',
        done: false,
        summary: 'Get blood flowing',
        time: '3 min',
      },
      {
        id: 'step-3',
        text: 'Do your main workout',
        done: false,
        summary: 'Whatever you planned - just move',
        time: '15-30 min',
      },
      {
        id: 'step-4',
        text: 'Cool down and stretch',
        done: false,
        summary: 'Help your muscles recover',
        time: '5 min',
      },
      {
        id: 'step-5',
        text: 'Log your workout (even just "did it")',
        done: false,
        summary: 'Track progress over time',
        time: '1 min',
      },
    ],
  },
]

// Group templates by category for display
export const templateCategories = [
  { id: 'productivity', label: 'Productivity', icon: '⚡' },
  { id: 'self-care', label: 'Self-Care', icon: '✨' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'work', label: 'Work', icon: '💼' },
  { id: 'health', label: 'Health', icon: '❤️' },
] as const

export function getTemplatesByCategory(category: string): TaskTemplate[] {
  return taskTemplates.filter(t => t.category === category)
}

export function getTemplateById(id: string): TaskTemplate | undefined {
  return taskTemplates.find(t => t.id === id)
}

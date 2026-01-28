// Standard option text for "specify your own" answers
export const OTHER_SPECIFY_OPTION = 'Other (I will specify)'

export const content = {
  // Clickable suggestion chips shown in empty state
  homeSuggestions: [
    'Cancel a subscription',
    'Renew my license',
    'Plan a birthday party',
    'Learn something new',
  ],
  placeholders: {
    homeInput: "What do you need to get done?",
    taskInput: 'Ask anything about this...',
    taskFollowUp: 'Ask a follow-up...',
    taskStepContext: 'Ask a question or add context...',
    aiTypeahead: 'Type to search...',
    aiFreeText: 'Type your answer…',
  },
  // Animated placeholder examples that cycle through
  animatedPlaceholders: [
    'renew my passport...',
    'cancel my gym membership...',
    'file my taxes...',
    'plan a trip to Japan...',
    'learn to play piano...',
    'write a best man speech...',
  ],
  hints: {
    aiAnswerBelow: 'Type your answer below.',
  },
  emptyStates: {
    homeNoTasksTitle: 'What do you need help with?',
    homeNoTasksBody: "Tell me what's on your plate — I'll break it into steps",
    homeNoStepsTitle: 'No steps yet',
    homeNoStepsBody: 'Open a task to add steps or ask the AI to break it down.',
    homeAllCaughtUpTitle: 'All done',
    homeAllCaughtUpBody: 'Nothing left. Enjoy it.',
    taskNoStepsTitle: 'No steps yet',
    taskNoStepsBody: 'Ask to break this down into steps',
  },
  labels: {
    context: 'Context',
  },
  demo: {
    tasksStorageKey: 'gather-demo-tasks-v2',
  },
}

const DMV_REAL_ID_LEGACY = 'sa.dmv.ca.gov/DMV/ukp.aspx?pid=1&ruleid=198'
const DMV_REAL_ID_DIRECT = 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/'

export function normalizeActionUrl(url: string): string
export function normalizeActionUrl(url: undefined): undefined
export function normalizeActionUrl(url?: string): string | undefined
export function normalizeActionUrl(url?: string): string | undefined {
  if (!url) return url
  if (url.includes(DMV_REAL_ID_LEGACY)) {
    return DMV_REAL_ID_DIRECT
  }
  return url
}

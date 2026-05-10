export const STATUSES = ['Ongoing', 'Completed', 'On-Hold', 'On-Queue'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_BG: Record<string, string> = {
  Completed: 'rgb(106,168,79)',
  Ongoing: 'rgb(255,217,102)',
  'On-Hold': 'rgb(224,102,102)',
  'On-Queue': 'rgb(109,158,235)',
}

export const STATUS_FG: Record<string, string> = {
  Completed: '#0a1f06',
  Ongoing: '#3a2a00',
  'On-Hold': '#3a0606',
  'On-Queue': '#0a1530',
}

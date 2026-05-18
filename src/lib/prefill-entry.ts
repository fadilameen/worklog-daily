export const PREFILL_STORAGE_KEY = 'prefill-entry'

export interface PrefillEntry {
  projectId: number
  projectName: string
  taskId: number
  taskName: string
  hours: number
  description: string
  status?: string
}

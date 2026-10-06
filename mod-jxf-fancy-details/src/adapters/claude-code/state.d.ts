export type FancyTokenUsage = { input: number; cacheRead: number; cacheWrite: number; output: number }

export type FancyCost = { usd: number; isLowerBound: boolean }

export type FancyTotals = { usage: FancyTokenUsage; cost: FancyCost; activeMs: number }

export type FancyPrompt = { id: string; turn: number; submittedAt: number; firstReplyAt?: number }

export type FancyStep = {
  id: string
  turn: number
  startedAt: number
  model: string
  endedAt?: number
  usage?: FancyTokenUsage
  cost?: FancyCost
  totals?: FancyTotals
}

export type FancyMark = {
  id: string
  kind: 'message' | 'tool'
  turn: number
  seq: number
  startedAt: number
  stepId?: string
  endedAt?: number
}

export type FancyLedger = {
  turn: number
  seq: number
  prompts: Readonly<Record<string, FancyPrompt>>
  steps: Readonly<Record<string, FancyStep>>
  marks: Readonly<Record<string, FancyMark>>
  currentPromptId?: string
  currentStepId?: string
  totals: FancyTotals
}

export type FancyRows = {
  aliases: Readonly<Record<string, string>>
  texts: Readonly<Record<string, string>>
}

export type FancyDays = Readonly<Record<string, FancyTotals>>

export type FancyJournal = { ledger: FancyLedger; days: FancyDays }

export type FancyOtherSessions = { day: string; totals: FancyTotals }

export type FancyQuotaWindow = { kind: string; percentUsed: number; resetsAt?: string }

export type FancyContextFill = { tokens?: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'mod-jxf-fancy-details': {
      journal: FancyJournal
      others: FancyOtherSessions
      rows: FancyRows
      rateLimits: readonly FancyQuotaWindow[]
      context: FancyContextFill | null
      branch: string | null
    }
  }
}

export type SessionTitleBand =
  | { kind: 'idle' }
  | { kind: 'asking'; modelLabel: string; startedAt: number }
  | { kind: 'titled'; title: string }

declare module 'claude-code' {
  interface PluginState {
    'mod-jxf-session-title': {
      band: SessionTitleBand
      transcript: string | null
      unappliedTitle: string | null
      nativeTitle: string | null
    }
  }
}

export type TitleRecord = { title: string; model: string; generatedAt: string }

export type Files = {
  read(path: string): Promise<string>
  write(path: string, text: string): Promise<void>
}

export type TitleStore = {
  read(): Promise<TitleRecord | undefined>
  write(record: TitleRecord): Promise<void>
}

const SESSION_SUFFIX = '.jsonl'
const SIDECAR_SUFFIX = '.session-title.json'

export function sidecarPath(sessionFile: string): string {
  const base = sessionFile.endsWith(SESSION_SUFFIX) ? sessionFile.slice(0, -SESSION_SUFFIX.length) : sessionFile

  return `${base}${SIDECAR_SUFFIX}`
}

export function parseRecord(text: string): TitleRecord | undefined {
  try {
    const value = JSON.parse(text) as Partial<TitleRecord> | null
    const isRecord = typeof value?.title === 'string' && typeof value.model === 'string' && typeof value.generatedAt === 'string'

    return isRecord && value.title !== '' ? (value as TitleRecord) : undefined
  } catch {
    return undefined
  }
}

export function sidecarStore(files: Files, sessionFile: string): TitleStore {
  const path = sidecarPath(sessionFile)

  return {
    read: () => files.read(path).then(parseRecord, () => undefined),
    write: record => files.write(path, `${JSON.stringify(record)}\n`),
  }
}

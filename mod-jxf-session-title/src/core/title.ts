export type TitleSettings = { instructions: string; maxPromptChars: number; maxTitleChars: number; maxReplyTokens: number }

export type TitleRequest = { system: string; prompt: string; maxTokens: number }

const PROMPT_SEPARATOR = '\n\n'
const OPEN_TAG = '<request>\n'
const CLOSE_TAG = '\n</request>'
const WHITESPACE = /\s+/g
const WRAPPING_QUOTES = /^["'`“”‘’]+|["'`“”‘’]+$/g
const TRAILING_PUNCTUATION = /[.!?:;,]+$/
const TITLE_LABEL = /^(?:session\s+)?title\s*:\s*/i

export function titleRequest(prompts: readonly string[], settings: TitleSettings): TitleRequest {
  const text = prompts
    .map(prompt => prompt.trim())
    .filter(prompt => prompt !== '')
    .join(PROMPT_SEPARATOR)

  return {
    system: settings.instructions,
    prompt: `${OPEN_TAG}${text.slice(0, settings.maxPromptChars)}${CLOSE_TAG}`,
    maxTokens: settings.maxReplyTokens,
  }
}

export function cleanTitle(reply: string, maxChars: number): string | undefined {
  const firstLine = reply.trim().split('\n')[0] ?? ''
  const title = firstLine
    .replace(WHITESPACE, ' ')
    .trim()
    .replace(TITLE_LABEL, '')
    .replace(WRAPPING_QUOTES, '')
    .replace(TRAILING_PUNCTUATION, '')
    .trim()

  return title === '' ? undefined : title.slice(0, maxChars).trimEnd()
}

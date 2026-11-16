import type { ExplainInput } from './gemini'

/** Messages sent from the side panel to the service worker. */
export interface ExplainMessage {
  type: 'explain'
  input: ExplainInput
}

export type ExplainReply =
  | { ok: true; text: string }
  | { ok: false; message: string }

export function requestExplanation(input: ExplainInput): Promise<ExplainReply> {
  const message: ExplainMessage = { type: 'explain', input }
  return chrome.runtime.sendMessage<ExplainMessage, ExplainReply>(message)
}

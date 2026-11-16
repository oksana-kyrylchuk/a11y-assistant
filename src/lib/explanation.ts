export interface ExplanationBlock {
  type: 'text' | 'code'
  content: string
}

/**
 * Splits a model answer into paragraphs and fenced code blocks, so the panel
 * can render it without interpreting any markup from the model.
 */
export function parseExplanation(answer: string): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = []
  // Odd-numbered pieces are the insides of ``` fences.
  answer.split('```').forEach((piece, index) => {
    if (index % 2 === 1) {
      // Drop the language tag on the opening fence line ("```html").
      const code = piece.replace(/^[\w-]*\n/, '').trim()
      if (code) blocks.push({ type: 'code', content: code })
      return
    }
    for (const paragraph of piece.split(/\n\s*\n/)) {
      const text = paragraph.trim()
      if (text) blocks.push({ type: 'text', content: text })
    }
  })
  return blocks
}

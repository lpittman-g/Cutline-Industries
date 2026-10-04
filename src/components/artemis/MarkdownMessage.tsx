import { type ReactNode } from 'react'

function parseInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const raw = m[0]
    if (raw.startsWith('`')) {
      parts.push(<code key={key++} className="artemis-inline-code">{raw.slice(1, -1)}</code>)
    } else if (raw.startsWith('**')) {
      parts.push(<strong key={key++}>{raw.slice(2, -2)}</strong>)
    } else {
      parts.push(<em key={key++}>{raw.slice(1, -1)}</em>)
    }
    last = m.index + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const copy = () => void navigator.clipboard.writeText(code)
  return (
    <div className="artemis-code-block">
      {lang && <span className="artemis-code-lang">{lang}</span>}
      <button type="button" className="artemis-code-copy" onClick={copy} aria-label="Copy code">
        Copy
      </button>
      <pre><code>{code}</code></pre>
    </div>
  )
}

export function MarkdownMessage({ content }: { content: string }) {
  if (!content) return null
  const nodes: ReactNode[] = []
  const lines = content.split('\n')
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      nodes.push(<CodeBlock key={key++} lang={lang} code={codeLines.join('\n')} />)
      continue
    }

    // heading
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      nodes.push(<Tag key={key++} className={`artemis-md-h${level}`}>{parseInline(hm[2])}</Tag>)
      i++
      continue
    }

    // bullet list — collect consecutive items
    if (/^[-*]\s/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].slice(2))}</li>)
        i++
      }
      nodes.push(<ul key={key++} className="artemis-md-list">{items}</ul>)
      continue
    }

    // numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^\d+\.\s/, ''))}</li>)
        i++
      }
      nodes.push(<ol key={key++} className="artemis-md-list">{items}</ol>)
      continue
    }

    // blank line — skip
    if (!line.trim()) {
      i++
      continue
    }

    // paragraph
    nodes.push(<p key={key++}>{parseInline(line)}</p>)
    i++
  }

  return <>{nodes}</>
}

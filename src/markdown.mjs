export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch])
}

function renderInline(raw) {
  let text = String(raw ?? '')
  text = text
    .replace(/!\[[^\]]*\]\((?!https?:)[^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1')

  const codeSpans = []
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`
    codeSpans.push(`<code>${escapeHtml(code)}</code>`)
    return token
  })

  const links = []
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const token = `\u0000LINK${links.length}\u0000`
    links.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)
    return token
  })

  text = escapeHtml(text)

  text = text.replace(/(^|[\s(（])(https?:\/\/[^\s<)"'）】]+)/g, (_, pre, url) => (
    `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  ))

  text = text.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')

  text = text.replace(/\u0000LINK(\d+)\u0000/g, (_, idx) => links[Number(idx)] || '')
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)] || '')
  return text
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cell => cell.trim())
}

function isTableSeparator(line) {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  const cells = parseTableRow(trimmed)
  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c))
}

const openingFence = /^ {0,3}(`{3,})([^`]*)$/
const closingFence = /^ {0,3}(`{3,})[ \t]*$/

export function renderMarkdown(source) {
  const raw = String(source ?? '').replace(/\r\n/g, '\n').trim()
  if (!raw) return ''

  const lines = raw.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    const fence = line.match(openingFence)
    if (fence) {
      const lang = fence[2].trim().split(/\s+/, 1)[0]
      const codeLines = []
      i++
      while (i < lines.length) {
        const codeLine = lines[i++]
        const close = codeLine.match(closingFence)
        if (close && close[1].length >= fence[1].length) break
        codeLines.push(codeLine)
      }
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push('<hr>')
      i++
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      i++
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(line)
      i += 2
      const bodyRows = []
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        bodyRows.push(parseTableRow(lines[i]))
        i++
      }
      const thead = `<thead><tr>${headers.map(h => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`
      const tbody = bodyRows.length
        ? `<tbody>${bodyRows.map(row => `<tr>${headers.map((_, cIdx) => `<td>${renderInline(row[cIdx] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`
        : ''
      out.push(`<div class="ws-md-table"><table>${thead}${tbody}</table></div>`)
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${renderMarkdown(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, '').trim())}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, '').trim())}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paraLines = [renderInline(line)]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !openingFence.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(renderInline(lines[i]))
      i++
    }
    out.push(`<p>${paraLines.join('<br>')}</p>`)
  }

  return out.join('\n')
}

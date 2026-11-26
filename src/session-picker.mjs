import readline from 'node:readline'
import { stripVTControlCharacters } from 'node:util'
import { createSessionCatalog } from './detect.mjs'
import { resolveLang } from './i18n.mjs'

const groups = [undefined, 'codex', 'claude-code', 'workbuddy', 'antigravity']

function oneLine(text) {
  return stripVTControlCharacters(text).replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
}

function fit(text, columns) {
  let width = 0
  let out = ''
  for (const ch of oneLine(text)) {
    width += ch.codePointAt(0) > 0x1f00 ? 2 : 1
    if (width > columns - 1) return out + '…'
    out += ch
  }
  return out
}

export async function pickSession({ lang, input = process.stdin, output = process.stdout, list = createSessionCatalog() } = {}) {
  const zh = resolveLang(lang) === 'zh'
  const tabs = [zh ? '全部' : 'All', 'Codex', 'Claude Code', 'WorkBuddy', 'Antigravity']
  const size = Math.max(1, Math.min(10, (output.rows || 24) - 6))
  let tab = 0
  let search
  let rendered = 0
  let closed = false
  let fail
  const views = new Map()

  function newView(query) {
    const controller = new AbortController()
    return { query, controller, rows: [], selected: 0, done: false, loading: false,
      iterator: list({ group: groups[tab], query, signal: controller.signal }) }
  }

  function active() {
    if (search) return search
    if (!views.has(tab)) views.set(tab, newView())
    return views.get(tab)
  }

  function draw() {
    if (closed) return
    const view = active()
    const start = Math.floor(view.selected / size) * size
    const page = view.rows.slice(start, start + size)
    const cols = Math.max(1, (output.columns || 80) - 1)
    const headings = tabs.map((label, i) => i === tab ? '[' + label + ']' : label)
    const bar = headings.join('  ')
    const lines = [bar.length > cols ? headings[tab] : fit(bar, cols)]
    if (search) lines.push(fit('/ ' + search.query, cols))
    for (const [i, row] of page.entries()) {
      const selected = start + i === view.selected
      const source = groups[tab] === 'antigravity' ? row.toolLabel.replace(/^Antigravity /, '') : row.toolLabel
      const archive = row.archived ? (zh ? ' [已归档]' : ' [Archived]') : ''
      const line = fit((selected ? ' ❯ ' : '   ') + (i + 1) + '. ' + row.timeLabel + ' [' + source + ']' + archive + ' ' + row.preview, cols)
      lines.push(selected ? '\x1b[1;36m' + line + '\x1b[0m' : line)
    }
    if (!page.length) lines.push(view.done ? (zh ? '没有匹配的会话' : 'No matching sessions') : (zh ? '正在读取会话…' : 'Loading sessions…'))
    const help = search
      ? (zh ? '↑↓ 选择 · ←→ 翻页 · Enter 打开 · Esc 返回' : '↑↓ move · ←→ page · Enter open · Esc back')
      : (zh ? 'Tab 切换 · / 搜索 · ↑↓ 选择 · ←→ 翻页 · Enter 打开 · q 退出' : 'Tab switch · / search · ↑↓ move · ←→ page · Enter open · q quit')
    lines.push(fit(help, cols))
    if (rendered) {
      readline.moveCursor(output, 0, -rendered)
      readline.clearScreenDown(output)
    }
    output.write(lines.join('\n') + '\n')
    rendered = lines.length
  }

  async function fill(view) {
    if (view.loading || view.done) return
    view.loading = true
    try {
      while (!closed && !view.controller.signal.aborted && view.rows.length <= (Math.floor(view.selected / size) + 1) * size) {
        const { done, value } = await view.iterator.next()
        if (done) {
          view.done = true
          break
        }
        view.rows.push(value)
        if (view.rows.length === 1 && view === active()) draw()
      }
    } finally {
      view.loading = false
    }
    if (!closed && view === active()) draw()
  }

  function refresh() {
    draw()
    fill(active()).catch(fail)
  }

  function stopSearch() {
    search?.controller.abort()
    search = undefined
  }

  function searchFor(query) {
    stopSearch()
    search = newView(query)
  }

  const wasRaw = input.isRaw
  readline.emitKeypressEvents(input)
  input.setRawMode(true)
  let keypress
  try {
    return await new Promise((resolve, reject) => {
      fail = reject
      keypress = (str, key) => {
        const view = active()
        if (key.ctrl && key.name === 'c') return resolve(null)
        if (key.name === 'escape') {
          if (!search) return resolve(null)
          stopSearch()
        } else if (key.name === 'return' || key.name === 'enter') {
          if (view.rows[view.selected]) return resolve(view.rows[view.selected])
        } else if (key.name === 'tab') {
          stopSearch()
          tab = (tab + (key.shift ? -1 : 1) + tabs.length) % tabs.length
        } else if (key.name === 'up' || (!search && key.name === 'k')) {
          view.selected = Math.max(0, view.selected - 1)
        } else if (key.name === 'down' || (!search && key.name === 'j')) {
          view.selected = Math.max(0, Math.min(view.rows.length - 1, view.selected + 1))
        } else if (key.name === 'left' || key.name === 'pageup') {
          view.selected = Math.max(0, (Math.floor(view.selected / size) - 1) * size)
        } else if (key.name === 'right' || key.name === 'pagedown') {
          const next = (Math.floor(view.selected / size) + 1) * size
          if (next < view.rows.length) view.selected = next
        } else if (search && key.name === 'backspace') {
          searchFor(Array.from(search.query).slice(0, -1).join(''))
        } else if (search && str && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(str)) {
          searchFor(search.query + str)
        } else if (str === '/') {
          searchFor('')
        } else if (str === 'q') {
          return resolve(null)
        } else if (/^\d$/.test(str)) {
          const pos = Math.floor(view.selected / size) * size + (Number(str) || 10) - 1
          if (pos < view.rows.length) view.selected = pos
        } else return
        refresh()
      }
      input.on('keypress', keypress)
      refresh()
    })
  } finally {
    closed = true
    stopSearch()
    for (const view of views.values()) view.controller.abort()
    input.off('keypress', keypress)
    input.setRawMode(Boolean(wasRaw))
    input.pause()
  }
}

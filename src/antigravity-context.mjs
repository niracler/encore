import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function readAntigravityDatabase(path, read) {
  if (!existsSync(path)) return
  let db
  try {
    const Database = process.getBuiltinModule?.('node:sqlite')?.DatabaseSync
    db = Database && new Database(path, { readOnly: true })
    const query = sql => {
      if (db) return db.prepare(sql).all()
      const result = spawnSync('sqlite3', ['-readonly', '-json', path, sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      if (result.error || result.status !== 0) throw result.error || new Error(result.stderr)
      return JSON.parse(result.stdout || '[]')
    }
    return read(query, !!db)
  } catch {
    // Older versions, unavailable SQLite readers and incomplete native metadata
    // can still export a Replay directly from the transcript.
    return undefined
  } finally {
    db?.close()
  }
}

let generationType
const categoryFor = type => ({ 2: 'schema', 3: 'mem', 4: 'schema', 5: 'skill' })[type] || 'sys'

function openingContext(chat, breakdown, includeMemory) {
  const context = {}
  const sections = new Map(chat.promptSections.map(section => [section.title, section]))
  const tools = new Map(chat.tools.map(tool => [tool.name, tool]))
  let nextId = 0
  function add(category, title, payload, tokEst) {
    // A monolithic prompt can inline cross-session memory alongside system rules.
    const sensitive = category === 'mem' || /user_information|user_rules|MEMORY_SUMMARY|<conversation_history>/i.test(title + '\n' + payload)
    const record = { id: 'agy-init-' + nextId++, title,
      payload: sensitive && !includeMemory ? '[Private context omitted · --include-memory]' : payload }
    if (tokEst !== undefined) record.tokEst = tokEst
    context[category] ||= []
    context[category].push(record)
  }
  function addNamed(category, name, count) {
    const tool = category === 'schema' && tools.get(name)
    const section = sections.get(name)
    if (tool) {
      add(category, name, [tool.description, tool.jsonSchemaString].filter(Boolean).join('\n\n'), count)
      tools.delete(name)
    } else {
      add(category, name, section?.content || '', count)
      sections.delete(name)
    }
  }
  if (breakdown?.groups.length) {
    // TOKEN_SOURCE_SYSTEM (1) identifies mounted input. Chat Messages (7)
    // include the first user turn and never belong to the opening baseline.
    const mounted = breakdown.groups.filter(group => group.source === 1 && group.type !== 7)
    if (mounted.length && breakdown.groups.reduce((n, group) => n + group.numTokens, 0) === breakdown.totalTokens) {
      context.estimatedTokens = mounted.reduce((n, group) => n + group.numTokens, 0)
    }
    for (const group of mounted) {
      const category = categoryFor(group.type)
      if (group.children.length) {
        for (const child of group.children) addNamed(category, child.name, child.numTokens)
      } else addNamed(category, group.name, group.numTokens)
    }
  }
  for (const section of sections.values()) add(categoryFor(section.tokenType), section.title, section.content)
  for (const tool of tools.values()) addNamed('schema', tool.name)
  if (!chat.promptSections.length && chat.systemPrompt) add('sys', 'System Prompt', chat.systemPrompt)
  return Object.keys(context).length ? context : undefined
}

export function readAntigravityContext(native, records, includeMemory) {
  const requests = records.filter(row => row.type === 'PLANNER_RESPONSE').map(row => row.step_index)
  if (!native || !requests.length) return
  const dbPath = join(native.root, '..', '..', 'conversations', native.id + '.db')
  return readAntigravityDatabase(dbPath, (query, binary) => {
    generationType ||= require('protobufjs').loadSync(fileURLToPath(new URL('./antigravity-context.proto', import.meta.url))).lookupType('CortexStepGeneratorMetadata')
    const windows = new Map()
    const breakdowns = new Map()
    let initialContext
    let cursor = -1
    for (;;) {
      const rows = query('SELECT idx, ' + (binary ? 'data' : 'hex(data)') + ' AS payload FROM gen_metadata WHERE idx > ' + cursor + ' ORDER BY idx LIMIT 16')
      if (!rows.length) break
      for (const row of rows) {
        cursor = row.idx
        const bytes = binary ? row.payload : Buffer.from(row.payload, 'hex')
        let generation
        try {
          generation = generationType.decode(bytes)
        } catch {
          // A damaged generation must not discard valid measurements from its neighbours.
          continue
        }
        const { chatModel: chat, stepIndices } = generation
        const window = chat?.chatStartMetadata?.contextWindowMetadata
        if (window?.tokenBreakdown?.groups.length) {
          const estimates = {}
          for (const group of window.tokenBreakdown.groups) {
            if (group.source !== 1 || group.type === 7) continue
            const category = categoryFor(group.type)
            estimates[category] = (estimates[category] || 0) + group.numTokens
          }
          for (const step of stepIndices) breakdowns.set(step, estimates)
        }
        if (window?.maxContextTokens > 0) for (const step of stepIndices) windows.set(step, window.maxContextTokens)
        if (row.idx === 0 && chat && stepIndices.includes(requests[0]) && records[0]?.step_index === 0) {
          initialContext = openingContext(chat, window?.tokenBreakdown, includeMemory)
        }
      }
    }
    const limits = new Set(requests.map(step => windows.get(step)))
    return { initialContext, contextWindow: windows.get(requests[0]), variableWindows: limits.size > 1, windows, breakdowns }
  })
}

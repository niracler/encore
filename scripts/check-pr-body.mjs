import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REQUIRED_SECTIONS = ['Summary', 'Evidence', 'Merge Danger']
const PLACEHOLDER_PATTERN = /<\s*(?:diagram\b[^>]*|screenshot\b[^>]*|one-way\s+or\s+two-way|one-word\b[^>]*|optional\s*:[^>]*|todo\b[^>]*|tbd\b[^>]*|placeholder\b[^>]*)\s*>/i
const SINGLE_WORD_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u
const TABLE_DELIMITER_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/

function matchOpeningFence(line) {
  const backtickMatch = /^[ ]{0,3}(`{3,})[^`]*$/.exec(line)
  if (backtickMatch) return { char: '`', length: backtickMatch[1].length }
  const tildeMatch = /^[ ]{0,3}(~{3,}).*$/.exec(line)
  if (tildeMatch) return { char: '~', length: tildeMatch[1].length }
  return null
}

function isClosingFence(line, fence) {
  const pattern = new RegExp(`^[ ]{0,3}${fence.char}{${fence.length},}[ ]*$`)
  return pattern.test(line)
}

function stripHtmlCommentsOutsideFences(markdown) {
  const lines = markdown.split('\n')
  const output = []
  let activeFence = null
  let inComment = false

  for (const rawLine of lines) {
    if (activeFence) {
      output.push(rawLine)
      if (isClosingFence(rawLine, activeFence)) activeFence = null
      continue
    }

    let remaining = rawLine
    let cleaned = ''
    while (remaining.length > 0) {
      if (inComment) {
        const endIndex = remaining.indexOf('-->')
        if (endIndex === -1) {
          remaining = ''
          break
        }
        remaining = remaining.slice(endIndex + 3)
        inComment = false
        continue
      }

      const startIndex = remaining.indexOf('<!--')
      if (startIndex === -1) {
        cleaned += remaining
        remaining = ''
        break
      }

      cleaned += remaining.slice(0, startIndex)
      remaining = remaining.slice(startIndex + 4)
      inComment = true
    }

    if (!inComment) {
      const opened = matchOpeningFence(cleaned)
      if (opened) activeFence = opened
    }
    output.push(cleaned)
  }

  return output
}

function parseSections(lines) {
  const sections = []
  let current = null
  let activeFence = null

  for (const line of lines) {
    if (activeFence) {
      if (current) current.lines.push(line)
      if (isClosingFence(line, activeFence)) activeFence = null
      continue
    }

    const opened = matchOpeningFence(line)
    if (opened) {
      activeFence = opened
      if (current) current.lines.push(line)
      continue
    }

    const headingMatch = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line)
    if (headingMatch) {
      current = {
        title: headingMatch[1].trim(),
        lines: [],
      }
      sections.push(current)
      continue
    }

    if (current) current.lines.push(line)
  }

  return sections
}

function stripFencedBlocksAndInlineCode(lines) {
  const kept = []
  let activeFence = null

  for (const line of lines) {
    if (activeFence) {
      if (isClosingFence(line, activeFence)) activeFence = null
      continue
    }
    const opened = matchOpeningFence(line)
    if (opened) {
      activeFence = opened
      continue
    }
    kept.push(line.replace(/`[^`]*`/g, ''))
  }

  return kept
}

function findPlaceholder(lines) {
  const plainLines = stripFencedBlocksAndInlineCode(lines)
  for (const line of plainLines) {
    const match = PLACEHOLDER_PATTERN.exec(line)
    if (match) return match[0]
  }
  return null
}

function hasNonEmptyFencedCodeBlock(lines) {
  let activeFence = null
  let hasContent = false

  for (const line of lines) {
    if (activeFence) {
      if (isClosingFence(line, activeFence)) {
        if (hasContent) return true
        activeFence = null
        hasContent = false
      } else if (line.trim().length > 0) {
        hasContent = true
      }
      continue
    }

    const opened = matchOpeningFence(line)
    if (opened) {
      activeFence = opened
      hasContent = false
    }
  }

  return false
}

function hasMarkdownTable(lines) {
  let activeFence = null
  const plainLines = []

  for (const line of lines) {
    if (activeFence) {
      if (isClosingFence(line, activeFence)) activeFence = null
      plainLines.push('')
      continue
    }
    const opened = matchOpeningFence(line)
    if (opened) {
      activeFence = opened
      plainLines.push('')
      continue
    }
    plainLines.push(line)
  }

  for (let index = 0; index + 2 < plainLines.length; index += 1) {
    const headerLine = plainLines[index]
    const delimiterLine = plainLines[index + 1]
    const bodyLine = plainLines[index + 2]
    if (!headerLine.includes('|') || !/[^|\s]/.test(headerLine)) continue
    if (!TABLE_DELIMITER_PATTERN.test(delimiterLine)) continue
    if (bodyLine.includes('|') && /[^|\s]/.test(bodyLine)) return true
  }

  return false
}

function stripOptionalBackticks(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function hasMeaningfulContent(text) {
  const withoutPlaceholders = text.replace(new RegExp(PLACEHOLDER_PATTERN.source, 'gi'), '')
  return withoutPlaceholders.trim().length > 0
}

function validateEvidence(lines, errors) {
  let activeFence = null
  const entries = []
  let activeEntry = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (activeFence) {
      if (activeEntry) activeEntry.contentLines.push(line)
      if (isClosingFence(line, activeFence)) activeFence = null
      continue
    }

    const opened = matchOpeningFence(line)
    if (opened) {
      activeFence = opened
      if (activeEntry) activeEntry.contentLines.push(line)
      continue
    }

    const beforeMatch = /^\s*(?:[-*+]\s+)?\*\*Before(?::\*\*|\*\*:)(.*)$/i.exec(line)
    if (beforeMatch) {
      activeEntry = { kind: 'Before', lineIndex: index, contentLines: [beforeMatch[1]] }
      entries.push(activeEntry)
      continue
    }

    const afterMatch = /^\s*(?:[-*+]\s+)?\*\*After(?::\*\*|\*\*:)(.*)$/i.exec(line)
    if (afterMatch) {
      activeEntry = { kind: 'After', lineIndex: index, contentLines: [afterMatch[1]] }
      entries.push(activeEntry)
      continue
    }

    if (activeEntry) activeEntry.contentLines.push(line)
  }

  const beforeEntries = entries.filter(entry => entry.kind === 'Before')
  const afterEntries = entries.filter(entry => entry.kind === 'After')

  if (beforeEntries.length === 0) {
    errors.push('Section `## Evidence` must include `**Before:**` with concrete evidence.')
  }
  if (afterEntries.length === 0) {
    errors.push('Section `## Evidence` must include `**After:**` with concrete evidence.')
  }

  if (beforeEntries.length > 0 && afterEntries.length > 0) {
    if (afterEntries[0].lineIndex < beforeEntries[0].lineIndex) {
      errors.push('Section `## Evidence` must place `**Before:**` before `**After:**`.')
    }
  }

  for (const entry of entries) {
    if (!hasMeaningfulContent(entry.contentLines.join('\n'))) {
      errors.push(`Section \`## Evidence\` has an empty \`**${entry.kind}:**\` entry.`)
    }
  }
}

function validateMergeDanger(lines, errors) {
  let activeFence = null
  const doorValues = []
  const blastRadiusValues = []

  for (const line of lines) {
    if (activeFence) {
      if (isClosingFence(line, activeFence)) activeFence = null
      continue
    }
    const opened = matchOpeningFence(line)
    if (opened) {
      activeFence = opened
      continue
    }

    const doorMatch = /^\s*(?:[-*+]\s+)?\*\*Door(?::\*\*|\*\*:)\s*(.*)$/i.exec(line)
    if (doorMatch) {
      doorValues.push(doorMatch[1].trim())
      continue
    }

    const blastMatch = /^\s*(?:[-*+]\s+)?\*\*Blast Radius(?::\*\*|\*\*:)\s*(.*)$/i.exec(line)
    if (blastMatch) {
      blastRadiusValues.push(blastMatch[1].trim())
    }
  }

  if (doorValues.length === 0) {
    errors.push('Section `## Merge Danger` must declare `**Door:** one-way` or `**Door:** two-way`.')
  } else if (doorValues.length > 1) {
    errors.push('Section `## Merge Danger` must declare `**Door:**` only once.')
  } else {
    const door = stripOptionalBackticks(doorValues[0])
    if (!/^(?:one-way|two-way)$/i.test(door)) {
      errors.push(`Invalid \`**Door:**\` value "${doorValues[0]}". Expected \`one-way\` or \`two-way\`.`)
    }
  }

  if (blastRadiusValues.length === 0) {
    errors.push('Section `## Merge Danger` must declare `**Blast Radius:** <one-word>`.')
  } else if (blastRadiusValues.length > 1) {
    errors.push('Section `## Merge Danger` must declare `**Blast Radius:**` only once.')
  } else {
    const blastRadius = stripOptionalBackticks(blastRadiusValues[0])
    if (!blastRadius || PLACEHOLDER_PATTERN.test(blastRadius) || !SINGLE_WORD_PATTERN.test(blastRadius)) {
      errors.push(
        `Invalid \`**Blast Radius:**\` value "${blastRadiusValues[0]}". Expected a single word (for example \`docs\`, \`ci\`, \`player\`, \`cli\`, or \`showcase\`).`
      )
    }
  }
}

export function validatePrBody(rawBody) {
  const normalized = String(rawBody ?? '').replace(/\r\n?/g, '\n')
  if (!normalized.trim()) {
    return {
      ok: false,
      errors: ['PR body is empty. Include `## Summary`, `## Evidence`, and `## Merge Danger` sections.'],
    }
  }

  const cleanedLines = stripHtmlCommentsOutsideFences(normalized)
  const sections = parseSections(cleanedLines)
  const errors = []

  const sectionByTitle = new Map()
  const sectionOrder = new Map()

  sections.forEach((section, index) => {
    if (!REQUIRED_SECTIONS.includes(section.title)) return
    if (sectionByTitle.has(section.title)) {
      errors.push(`Duplicate section \`## ${section.title}\` found; include each required section only once.`)
      return
    }
    sectionByTitle.set(section.title, section)
    sectionOrder.set(section.title, index)
  })

  for (const requiredTitle of REQUIRED_SECTIONS) {
    if (!sectionByTitle.has(requiredTitle)) {
      errors.push(`Missing required section \`## ${requiredTitle}\`.`)
    }
  }

  if (REQUIRED_SECTIONS.every(title => sectionOrder.has(title))) {
    const indices = REQUIRED_SECTIONS.map(title => sectionOrder.get(title))
    if (!(indices[0] < indices[1] && indices[1] < indices[2])) {
      errors.push('Required sections must appear in order: `## Summary`, `## Evidence`, `## Merge Danger`.')
    }
  }

  for (const requiredTitle of REQUIRED_SECTIONS) {
    const section = sectionByTitle.get(requiredTitle)
    if (!section) continue

    if (!section.lines.join('\n').trim()) {
      errors.push(`Section \`## ${requiredTitle}\` must not be empty.`)
      continue
    }

    const leftoverPlaceholder = findPlaceholder(section.lines)
    if (leftoverPlaceholder) {
      errors.push(`Section \`## ${requiredTitle}\` still contains template placeholder \`${leftoverPlaceholder}\`.`)
    }

    if (requiredTitle === 'Summary') {
      if (!hasNonEmptyFencedCodeBlock(section.lines) && !hasMarkdownTable(section.lines)) {
        errors.push(
          'Section `## Summary` must include a non-empty fenced code block (diff, tree, pseudocode, or mermaid) or a Markdown table.'
        )
      }
    } else if (requiredTitle === 'Evidence') {
      validateEvidence(section.lines, errors)
    } else if (requiredTitle === 'Merge Danger') {
      validateMergeDanger(section.lines, errors)
    }
  }

  return { ok: errors.length === 0, errors }
}

function readInputBody(argv) {
  const fileFlagIndex = argv.indexOf('--file')
  if (fileFlagIndex !== -1) {
    const filePath = argv[fileFlagIndex + 1]
    if (!filePath) throw new Error('Missing path after --file')
    return readFileSync(filePath, 'utf8')
  }
  if (Object.prototype.hasOwnProperty.call(process.env, 'PR_BODY')) {
    return process.env.PR_BODY ?? ''
  }
  return readFileSync(0, 'utf8')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const body = readInputBody(process.argv.slice(2))
  const result = validatePrBody(body)
  if (result.ok) {
    console.log('PR body check passed.')
  } else {
    console.error('PR body check failed:')
    for (const error of result.errors) {
      console.error(`- ${error}`)
      if (process.env.GITHUB_ACTIONS === 'true') {
        console.error(`::error::${error}`)
      }
    }
    process.exit(1)
  }
}

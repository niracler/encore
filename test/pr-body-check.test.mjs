import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePrBody } from '../scripts/check-pr-body.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const validBodyWithDiff = `## Summary

Add deterministic PR body validation matching the PR template.

\`\`\`diff
 .github/
   PULL_REQUEST_TEMPLATE.md
+  workflows/pr-body-check.yml
 scripts/
+  check-pr-body.mjs
\`\`\`

## Evidence

- **Before:** Pull requests with empty or unstructured descriptions passed CI.
- **After:** \`node scripts/check-pr-body.mjs\` rejects invalid bodies and passes \`pnpm test\`.

## Merge Danger

**Door:** two-way

Workflow and template only; easy to revert.

**Blast Radius:** ci

Affects PR checks targeting \`main\`.
`

test('validatePrBody accepts a complete PR body with diff, Before/After, Door, and single-word Blast Radius', () => {
  const result = validatePrBody(validBodyWithDiff)
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('validatePrBody accepts Markdown tables, multiline code evidence, HTML tags, and comments', () => {
  const body = `## Summary

<!-- Ignored comment -->

| File | Change |
| --- | --- |
| \`src/render.mjs\` | Mount \`<div data-encore-player>\` cleanly |

## Evidence

- **Before:**
  \`\`\`text
  FAIL test/render.test.mjs
  \`\`\`
  **After:**
  \`\`\`text
  PASS test/render.test.mjs
  \`\`\`

<details>
<summary>Notes</summary>
Backticked \`<one-word description>\` in prose is allowed.
</details>

## Merge Danger

**Door:** \`Two-way\`

**Blast Radius:** \`player-ui\`
`
  const result = validatePrBody(body)
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('validatePrBody rejects the unedited repository PR template', () => {
  const template = readFileSync(join(repoRoot, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf8')
  const result = validatePrBody(template)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('## Summary')))
  assert.ok(result.errors.some(error => error.includes('**Door:**')))
  assert.ok(result.errors.some(error => error.includes('**Blast Radius:**')))
})

test('validatePrBody ignores H2 headings inside fenced code blocks', () => {
  const body = `## Summary

\`\`\`markdown
## Evidence
## Merge Danger
\`\`\`
`
  const result = validatePrBody(body)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('Missing required section `## Evidence`')))
  assert.ok(result.errors.some(error => error.includes('Missing required section `## Merge Danger`')))
})

test('validatePrBody rejects missing sections, wrong order, and duplicate sections', () => {
  const wrongOrder = `## Evidence

- **Before:** old
- **After:** new

## Summary

\`\`\`text
a -> b
\`\`\`

## Merge Danger

**Door:** one-way

**Blast Radius:** schema
`
  const orderResult = validatePrBody(wrongOrder)
  assert.equal(orderResult.ok, false)
  assert.ok(orderResult.errors.some(error => error.includes('in order')))

  const duplicate = `${validBodyWithDiff}\n## Summary\n\n\`\`\`text\nextra\n\`\`\`\n`
  const dupResult = validatePrBody(duplicate)
  assert.equal(dupResult.ok, false)
  assert.ok(dupResult.errors.some(error => error.includes('Duplicate section `## Summary`')))
})

test('validatePrBody rejects Summary without a non-empty code block or table', () => {
  const proseOnly = validBodyWithDiff.replace(/```diff[\s\S]*?```/, 'Just a sentence with no visual.')
  const proseResult = validatePrBody(proseOnly)
  assert.equal(proseResult.ok, false)
  assert.ok(proseResult.errors.some(error => error.includes('fenced code block')))

  const emptyFence = validBodyWithDiff.replace(/```diff[\s\S]*?```/, '```diff\n   \n```')
  const emptyFenceResult = validatePrBody(emptyFence)
  assert.equal(emptyFenceResult.ok, false)
  assert.ok(emptyFenceResult.errors.some(error => error.includes('fenced code block')))
})

test('validatePrBody enforces Before and After entries in Evidence', () => {
  const missingAfter = validBodyWithDiff.replace(/- \*\*After:\*\*.*\n/, '')
  const missingResult = validatePrBody(missingAfter)
  assert.equal(missingResult.ok, false)
  assert.ok(missingResult.errors.some(error => error.includes('**After:**')))

  const reversed = validBodyWithDiff.replace(
    /- \*\*Before:\*\*.*\n- \*\*After:\*\*.*\n/,
    '- **After:** passing\n- **Before:** failing\n'
  )
  const reversedResult = validatePrBody(reversed)
  assert.equal(reversedResult.ok, false)
  assert.ok(reversedResult.errors.some(error => error.includes('place `**Before:**` before `**After:**`')))
})

test('validatePrBody enforces Door values and single-word Blast Radius', () => {
  const invalidDoor = validBodyWithDiff.replace('**Door:** two-way', '**Door:** maybe')
  const doorResult = validatePrBody(invalidDoor)
  assert.equal(doorResult.ok, false)
  assert.ok(doorResult.errors.some(error => error.includes('Invalid `**Door:**`')))

  const multiWordBlast = validBodyWithDiff.replace('**Blast Radius:** ci', '**Blast Radius:** Showcase / Docs / Packaging')
  const blastResult = validatePrBody(multiWordBlast)
  assert.equal(blastResult.ok, false)
  assert.ok(blastResult.errors.some(error => error.includes('Invalid `**Blast Radius:**`')))
})

test('CLI exits 0 on valid PR_BODY and 1 on invalid PR_BODY', () => {
  const scriptPath = join(repoRoot, 'scripts', 'check-pr-body.mjs')
  const passRun = spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, PR_BODY: validBodyWithDiff },
    encoding: 'utf8',
  })
  assert.equal(passRun.status, 0)
  assert.match(passRun.stdout, /PR body check passed/)

  const failRun = spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, PR_BODY: '' },
    encoding: 'utf8',
  })
  assert.equal(failRun.status, 1)
  assert.match(failRun.stderr, /PR body is empty/)
})

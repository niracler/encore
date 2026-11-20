import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import xlsx from 'node-xlsx'

const directory = process.argv[2]
const seed = await readFile(new URL('./windows-smoke.jsonl', import.meta.url), 'utf8')
const records = seed.trim().split('\n').map(line => JSON.parse(line))
const start = Date.parse(records[0].timestamp)

function addMessage(role, text) {
  records.push({
    type: 'response_item',
    timestamp: new Date(start + records.length * 1000).toISOString(),
    payload: { type: 'message', role, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }] },
  })
}

addMessage('assistant', [
  '````markdown', '```diff', '+ nested example', '```', '````', '',
  '[Report](report.pdf) · [Inventory](inventory.xlsx) · [Archived](archived.xlsx)',
].join('\n'))
for (let turn = 1; turn <= 200; turn++) {
  addMessage('user', `Review batch ${turn}.`)
  addMessage('assistant', `Reviewed batch ${turn}.`)
}
addMessage('user', 'End of the replay.')
await writeFile(join(directory, '输入 日志.jsonl'), records.map(record => JSON.stringify(record)).join('\n') + '\n')

// archived.xlsx is referenced in the log but deliberately absent at export.
await writeFile(join(directory, 'inventory.xlsx'), xlsx.build([
  { name: 'Overview', data: [['Status'], ['Ready']] },
  { name: 'Stock', data: [['Item', 'Quantity'], ['B-02', 48]] },
]))

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent(`<style>
    @page { size: A5 portrait; }
    @page appendix { size: A5 landscape; }
    section { page: appendix; break-before: page; }
  </style><h1>Report</h1><section><h1>Appendix</h1></section>`)
  await page.pdf({ path: join(directory, 'report.pdf'), preferCSSPageSize: true })
} finally {
  await browser.close()
}

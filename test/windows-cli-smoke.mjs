import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import test from 'node:test'
import { chromium, expect } from '@playwright/test'

const message = '请显示这张样例截图。'

test('the packed CLI plays a long replay with readable and missing attachments', { timeout: 60_000 }, async t => {
  const consumer = process.env.SMOKE_DIR
  assert.ok(consumer, 'Set SMOKE_DIR to the directory containing the installed CLI and exported replay')
  const replay = join(consumer, '输出 回放')
  const session = JSON.parse(await readFile(join(replay, 'session.json'), 'utf8'))
  assert.ok(session.items.length >= 400, 'Expected a long synthetic session')
  assert.ok(session.items.some(item => item.type === 'user' && item.text.includes(message)))
  assert.equal(session.frames.length, 1)
  const frame = session.frames[0].img
  const image = await readFile(join(replay, frame))
  assert.equal(image.toString('ascii', 0, 4), 'RIFF')
  assert.equal(image.toString('ascii', 8, 12), 'WEBP')

  const pkgDir = join(consumer, 'node_modules', '@niracler', 'encore')
  const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'))
  const server = spawn(process.execPath, [join(pkgDir, pkg.bin.encore), 'play', replay, '--no-open'], {
    cwd: consumer, stdio: ['ignore', 'pipe', 'inherit'],
  })
  t.after(() => server.kill())
  const output = createInterface({ input: server.stdout })
  let url
  for await (const line of output) {
    url = line.match(/http:\/\/localhost:\d+/)?.[0]
    if (url) break
  }
  assert.ok(url, 'The preview process exited before reporting its URL')

  const browser = await chromium.launch()
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(10_000)
  let releaseSession
  const gate = new Promise(resolve => { releaseSession = resolve })
  await page.route('**/session.json', async route => {
    await gate
    await route.continue()
  })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const loading = page.getByRole('status').filter({ hasText: '正在加载回放' })
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/session.json')
  try {
    await expect(loading).toBeVisible()
  } finally {
    releaseSession()
  }
  const data = await response
  assert.equal(data.status(), 200)
  await expect(loading).toBeHidden()
  const prompt = page.locator('[data-kind="prompt"]')
  const text = prompt.getByText(message, { exact: true })
  await expect(text).toBeHidden()
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(text).toBeVisible()
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  await expect(text).toBeInViewport()
  const screenshot = prompt.getByRole('img', { name: session.frames[0].label, exact: true })
  await expect(screenshot).toBeVisible()
  await expect(screenshot).toBeInViewport()
  const decoded = await screenshot.evaluate(async img => {
    await img.decode()
    return { url: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight }
  })
  assert.deepEqual(decoded, { url: new URL(frame, url).href, width: 32, height: 24 })

  await page.getByRole('button', { name: '下一步', exact: true }).click()
  const missing = page.locator('[data-availability="missing"]').filter({ hasText: 'archived.xlsx' })
  await expect(missing.getByText('未找到原文件，无法回看')).toBeVisible()
  await expect(page.locator('.session-log code.language-markdown')).toHaveText('```diff\n+ nested example\n```')

  await page.getByRole('button', { name: '阅读报告' }).click()
  const pdf = page.getByRole('dialog', { name: 'report.pdf' })
  await expect(pdf.getByRole('spinbutton')).toHaveValue('1')
  await pdf.getByRole('button', { name: '下一页' }).click()
  await expect(pdf.getByRole('spinbutton')).toHaveValue('2')
  const appendix = pdf.getByRole('img', { name: '第 2 页' })
  await expect(appendix).toBeInViewport()
  assert.ok(await appendix.evaluate(async img => {
    await img.decode()
    return img.naturalWidth > img.naturalHeight
  }), 'The second PDF page must decode as the landscape appendix')
  await pdf.getByRole('button', { name: '关闭预览' }).click()

  await page.getByRole('button', { name: '查看完整表格' }).click()
  const workbook = page.getByRole('dialog', { name: 'inventory.xlsx' })
  const sheets = workbook.getByRole('combobox', { name: '工作表' })
  await expect(sheets).toHaveValue('Overview')
  await sheets.selectOption('Stock')
  const stock = workbook.getByRole('row').filter({ hasText: 'B-02' })
  await expect(stock.getByRole('cell')).toHaveText(['B-02', '48'])
  await workbook.getByRole('button', { name: '关闭预览' }).click()

  const counter = page.locator('[data-session-speed] b')
  const pausedAt = await counter.innerText()
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(counter).not.toHaveText(pausedAt)
  const lastStep = session.items.length
  const track = page.getByRole('slider', { name: '回放时间轴与控制' })
  await track.press('End')
  await expect(counter).toHaveText(String(lastStep))
  await expect(prompt.getByText('End of the replay.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeDisabled()

  await screenshot.click()
  await expect(counter).toHaveText(String(lastStep))
  await page.getByRole('dialog').getByRole('button', { name: '关闭预览' }).click()
  await text.click()
  await expect(track).toHaveValue('1')
  await expect(page.locator('.session-tl-cell').nth(1)).toHaveClass(/is-active/)
  await expect(counter).toHaveText('1')
  await expect(prompt.getByText('End of the replay.', { exact: true })).toBeHidden()
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(counter).toHaveText('2')
})

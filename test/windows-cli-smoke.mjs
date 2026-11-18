import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import test from 'node:test'
import { chromium, expect } from '@playwright/test'

const message = '请显示这张样例截图。'

test('the installed CLI serves a playable message and WebP screenshot', { timeout: 60_000 }, async t => {
  const consumer = process.env.SMOKE_DIR
  assert.ok(consumer, 'Set SMOKE_DIR to the directory containing the installed CLI and exported replay')
  const replay = join(consumer, '输出 回放')
  const session = JSON.parse(await readFile(join(replay, 'session.json'), 'utf8'))
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
  const [data] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/session.json'),
    page.goto(url),
  ])
  assert.equal(data.status(), 200)
  const prompt = page.locator('[data-kind="prompt"]')
  const text = prompt.getByText('这条消息用于验证合并拦截。', { exact: true })
  await expect(text).toBeHidden()
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(text).toBeVisible()
  await expect(text).toBeInViewport()
  const screenshot = prompt.getByRole('img', { name: session.frames[0].label, exact: true })
  await expect(screenshot).toBeVisible()
  await expect(screenshot).toBeInViewport()
  const decoded = await screenshot.evaluate(async img => {
    await img.decode()
    return { url: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight }
  })
  assert.deepEqual(decoded, { url: new URL(frame, url).href, width: 32, height: 24 })
})

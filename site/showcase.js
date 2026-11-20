const copy = {
  en: {
    japanTrip: 'Japan trip replay', japanMeta: 'Full session · Both films',
    tagline: 'Bring your AI agent sessions back on stage — like asciinema, for AI agents.',
    command: 'Quick start command', copyCommand: 'Copy CLI command', copy: 'Copy',
    copied: 'Copied!', copyFailed: 'Copy failed', cases: 'Live cases',
    first: '70 Years of AI · First cut', firstMeta: 'From idea to preview',
    final: '70 Years of AI · Final cut', finalMeta: 'Revising after feedback',
    buyers: 'Overseas lighting buyers', codexBuyersMeta: 'Three markets · 26 leads',
    workbuddyBuyersMeta: 'Retrying tasks · 32 leads',
    back: '← All cases', film: 'Watch the film', loadError: 'Could not load this replay. Refresh the page to try again.',
  },
  zh: {
    japanTrip: '日本游记地图回放', japanMeta: '完整会话 · 两份有声成片',
    tagline: '回放 AI Agent 的工作过程，像用 asciinema 回看终端操作一样。',
    command: '快速开始命令', copyCommand: '复制命令', copy: '复制',
    copied: '已复制', copyFailed: '复制失败', cases: '案例回放',
    first: '《AI 七十年》首版', firstMeta: '从构思到第一支预览片',
    final: '《AI 七十年》定稿', finalMeta: '根据反馈剪出横竖两版',
    buyers: '调研海外照明采购方', codexBuyersMeta: '分头调查三地市场 · 26 家潜在客户',
    workbuddyBuyersMeta: '重新分派中断任务 · 32 家潜在客户',
    back: '← 返回案例', film: '观看成片', loadError: '回放加载失败，请刷新页面重试。',
  },
}

// Chinese guides and frame captions live with each original transcript.
const englishGuides = new Map([
  ['ai-tree-1014', {
    title: '70 Years of AI · Making the first cut',
    description: 'How would you tell the history of AI to your family? After discussing a hand-drawn style and narration, Claude called on seven sub-agents to check the history and prepare a script for a 4-minute, 10-second preview.',
  }],
  ['ai-tree-1015', {
    title: '70 Years of AI · Revising the final cut',
    description: 'Feedback on the first cut led to more historical photos and a visual glossary in place of the on-screen term counter. The session ends with a 5-minute, 14-second film in landscape and portrait.',
    deliverables: [{ title: '70 Years of AI', meta: '5 min 14 sec' }],
  }],
  ['lesson-00-buyers-codex', {
    title: 'Codex researches overseas lighting buyers',
    description: 'Codex assigned three sub-agents to research Germany, the UK and Australia. In 26 minutes, it returned a 31-page report and a spreadsheet listing 26 prospective buyers.',
    deliverables: [
      { title: 'Overseas lighting buyers research report', meta: '31-page PDF · Copy-edited course edition' },
      { title: 'Prospective buyers', meta: 'Spreadsheet · 8 in Germany, 9 in Australia and 9 in the UK' },
    ],
  }],
  ['lesson-00-buyers-workbuddy', {
    title: 'WorkBuddy researches overseas lighting buyers',
    description: 'WorkBuddy launched five research tasks in parallel. Three hit a quota limit and had to be reassigned. In 36 minutes, it returned a 26-page report and a spreadsheet listing 32 prospective buyers.',
  }],
  ['poster-redesign', {
    title: 'Redesigning the course poster',
    description: 'The first pixel-art poster felt crowded. Codex reworked the characters and lettering, resumed after a context compaction, and produced three designs in burgundy, pine green and midnight purple.',
    frames: ['Original pixel-art course map', 'First redesign', 'Refining the details', 'Moving the lead character to the computer', 'Graphite and burgundy editorial layout', 'Pine-green three-act layout', 'Midnight-purple stage layout'],
  }],
  ['work-stages-site', {
    title: 'Adding the new diagram to the slides and course site',
    description: 'Claude Code worked from an exported canvas. Four sub-agents mapped the slides and website before the new diagram went in. The replay includes the fix for a page displaying its script as text.',
    frames: ['The new diagram in its light theme', 'Added to lesson zero', 'Updated diagram for the outline', 'The page displays the script as text', 'The repaired diagram page'],
  }],
  ['work-stages-design', {
    title: 'Redrawing the seven stages of human–AI collaboration',
    description: 'The first cards were hard to read. Claude explored several ways to draw the stages, then refined the selected hairpin layout into the final light version.',
    frames: ['First card layout', 'A · Parallel tracks', 'B · Hairpin route', 'C · Field-guide cards', 'D · Viewfinder', 'E · Two-tone ribbon', 'F · River', 'Refining the hairpin route', 'Final light version'],
  }],
  ['xcmd-research', {
    title: 'Researching the open-source x-cmd toolkit',
    description: 'WorkBuddy used public sources to trace the project’s releases and compare competing tools. Four sub-agents contributed to a roughly 15,000-character report in 18 minutes.',
  }],
])

const url = new URL(location.href)
const requestedLang = url.searchParams.get('lang')
let lang = ['en', 'zh'].includes(requestedLang)
  ? requestedLang
  : navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'

const mount = document.querySelector('[data-case-id]')

function renderDirectory() {
  const messages = copy[lang]
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  const languageButton = document.querySelector('#showcase-language')
  languageButton.lang = lang === 'zh' ? 'en' : 'zh-CN'
  languageButton.textContent = lang === 'zh' ? 'English' : '中文'
  document.querySelectorAll('[data-text]').forEach(el => { el.textContent = messages[el.dataset.text] })
  document.querySelectorAll('[data-label]').forEach(el => { el.setAttribute('aria-label', messages[el.dataset.label]) })
  for (const link of document.querySelectorAll('.showcase-directory a')) {
    const target = new URL(link.href)
    target.searchParams.set('lang', lang)
    link.href = target
  }
}

async function renderReplay(demoId) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  const backHref = '../../?lang=' + lang
  const messages = copy[lang]
  const back = document.createElement('a')
  back.href = backHref
  back.textContent = messages.back
  back.className = 'session-back'
  const status = document.createElement('p')
  status.className = 'encore-loading'
  status.setAttribute('role', 'status')
  status.textContent = lang === 'zh' ? '正在加载回放…' : 'Loading replay…'
  mount.append(back, status)
  try {
    const response = await fetch('./session.json')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const session = await response.json()
    const guide = lang === 'en' && englishGuides.get(demoId)
    if (guide) {
      session.title = guide.title
      session.description = guide.description
      if (guide.frames) session.frames = session.frames.map((frame, i) => ({ ...frame, label: guide.frames[i] }))
      if (guide.deliverables) session.deliverables = session.deliverables.map((file, i) => ({ ...file, ...guide.deliverables[i] }))
    }
    const baseUrl = demoId === 'japan-trip' ? 'https://encore-media.niracler.com/japan-trip/v1/' : './'
    const player = await window.EncorePlayer.create(mount, session, {
      lang, baseUrl, backHref, backLabel: messages.back, showLangToggle: false,
    })
    mount.querySelectorAll('.session-you .session-bubble, .session-ai-body').forEach(el => { el.lang = 'zh-CN' })
    if (location.hash === '#film') {
      const video = mount.querySelector('[data-final-files] video') || mount.querySelector('.session-files video')
      if (video) {
        player.getController().goToStage(Number(video.closest('[data-for-step]').dataset.forStep), false)
        video.focus({ preventScroll: true })
        video.closest('figure').scrollIntoView({ block: 'center' })
      }
    }
  } catch (error) {
    console.error(error)
    status.className = 'encore-load-error'
    status.setAttribute('role', 'alert')
    status.textContent = messages.loadError
    mount.replaceChildren(back, status)
  }
}

if (mount) {
  await renderReplay(mount.dataset.caseId)
} else {
  renderDirectory()
  document.querySelector('#showcase-language').addEventListener('click', () => {
    lang = lang === 'en' ? 'zh' : 'en'
    url.searchParams.set('lang', lang)
    history.replaceState(null, '', url)
    renderDirectory()
  })
  const copyButton = document.querySelector('#encore-copy-btn')
  let copyTimer
  copyButton.addEventListener('click', async () => {
    clearTimeout(copyTimer)
    try {
      await navigator.clipboard.writeText(document.querySelector('#encore-cli-cmd').textContent)
      copyButton.textContent = copy[lang].copied
    } catch {
      copyButton.textContent = copy[lang].copyFailed
    }
    copyTimer = setTimeout(() => { copyButton.textContent = copy[lang].copy }, 1600)
  })
}

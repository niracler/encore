import { createTranslator, resolveLang } from './i18n.mjs'
import { escapeHtml } from './markdown.mjs'
import { buildPlayerData, elapsedClock, renderPlayerWidget, wallClock } from './render.mjs'
import { timeline } from './timeline.mjs'

const shorten = (text, length) => (text.length > length ? `${text.slice(0, length)}…` : text)

function buildTypewriterFrames(text, count = 14) {
  const clean = String(text || '').trim()
  if (!clean) return ['']
  const total = Math.min(count, Math.max(3, clean.length))
  const frames = []
  for (let i = 1; i <= total; i++) {
    frames.push(clean.slice(0, Math.ceil((clean.length * i) / total)))
  }
  return frames
}

function splitReplyChunks(text, chunkSize = 5) {
  const clean = String(text || '')
  if (!clean) return ['']
  const chunks = []
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize))
  }
  return chunks
}

export function createSessionPlaybackModel(session) {
  const steps = session.steps || []
  const contextRecords = session.contextRecords || {}
  const initCatMap = Object.fromEntries((session.initialSnapshot?.categories || []).map(c => [c.id, c]))
  let mode = 'overview'
  let currentIndex = Math.max(0, steps.length - 1)

  function hydrateSnapshot(snap) {
    if (!snap || !Array.isArray(snap.categories)) return snap
    return {
      ...snap,
      categories: snap.categories.map(cat => {
        const baseCat = initCatMap[cat.id] || {}
        const merged = {
          ...cat,
          name: cat.name || baseCat.name || cat.id,
          color: cat.color || baseCat.color || cat.id,
          itemIds: cat.itemIds || baseCat.itemIds || [],
        }
        if (Array.isArray(cat.items)) return merged
        const newSet = new Set(cat.newIds || [])
        const items = merged.itemIds
          .map(id => contextRecords[id] && ({ ...contextRecords[id], isNew: newSet.has(id) }))
          .filter(Boolean)
        return { ...merged, items }
      }),
    }
  }

  function decorateStep(index) {
    const clamped = Math.max(0, Math.min(steps.length - 1, index))
    currentIndex = clamped
    const step = steps[clamped]
    return {
      ...step,
      contextSnapshot: hydrateSnapshot(step.contextSnapshot),
      dimChat: step.kind === 'spotlight-change' && step.spotlight !== 'none',
      typewriterFrames: step.kind === 'prompt' ? buildTypewriterFrames(step.summary) : [],
      replyChunks: step.kind === 'reply' ? splitReplyChunks(step.summary) : [],
    }
  }

  return {
    getMode: () => mode,
    setMode: nextMode => {
      if (['overview', 'inspector', 'curve'].includes(nextMode)) mode = nextMode
      return mode
    },
    getSteps: () => steps,
    hydrateSnapshot,
    getCurrentIndex: () => currentIndex,
    selectStep: index => decorateStep(index),
    stepAtTime: time => {
      let idx = steps.findLastIndex(step => step.t <= time)
      if (idx < 0) idx = 0
      return decorateStep(idx)
    },
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.createSessionPlaybackModel = createSessionPlaybackModel
}

export function attachPlayerController(containerEl, playerData, { lang = 'zh', initialStep = -1, onToggleLang } = {}) {
  const t = createTranslator(lang)
  const appEl = containerEl.querySelector('.session-app') || containerEl
  const root = containerEl.querySelector('.session-player')
  const play = containerEl.querySelector('.session-play')
  const prevBtn = containerEl.querySelector('[data-session-prev]')
  const nextBtn = containerEl.querySelector('[data-session-next]')
  const speedBadge = containerEl.querySelector('[data-session-speed]')
  const scrubber = root?.querySelector('.session-scrubber')
  const head = scrubber?.querySelector('.session-playhead')
  const width = scrubber?.viewBox?.baseVal?.width || 1040
  const log = containerEl.querySelector('.session-log')
  const chatPane = containerEl.querySelector('[data-session-chat]')
  const chatScroll = containerEl.querySelector('[data-session-scroll]') || chatPane
  const emptyStage = containerEl.querySelector('[data-session-empty]')
  const asidePane = containerEl.querySelector('[data-session-aside]')
  const snapLabel = asidePane?.querySelector('[data-context-snap]')
  const stackedBar = asidePane?.querySelector('[data-stacked-bar]')
  const composer = containerEl.querySelector('[data-session-composer]')
  const stageTrigger = containerEl.querySelector('[data-session-stage-trigger]')
  const composerText = containerEl.querySelector('[data-session-composer-text]')
  const sendBtn = containerEl.querySelector('[data-session-send]')
  const progressBar = containerEl.querySelector('[data-session-progress]')
  const timelineBar = containerEl.querySelector('[data-session-timeline]')
  const tlTrack = timelineBar?.querySelector('[data-tl-track]')
  const tlPop = timelineBar?.querySelector('[data-tl-pop]')
  const tlSegs = timelineBar ? [...timelineBar.querySelectorAll('[data-tl-step]')] : []
  const tlPins = timelineBar ? [...timelineBar.querySelectorAll('[data-tl-jump]')] : []
  const lightbox = containerEl.querySelector('[data-session-lightbox]')
  const lightboxImg = lightbox?.querySelector('[data-lightbox-img]')
  const lightboxDoc = lightbox?.querySelector('[data-lightbox-doc]')
  const lightboxTitle = lightbox?.querySelector('[data-lightbox-title]')
  const lightboxClose = lightbox?.querySelector('[data-lightbox-close]')
  const langToggleBtn = containerEl.querySelector('[data-encore-lang-toggle]')

  const stepEntries = log ? [...log.querySelectorAll('.session-entry[data-step]')].map(entry => ({
    entry,
    stepIndex: Number(entry.dataset.step),
    t: Number(entry.dataset.t),
  })) : []
  const auxEntries = log ? [...log.querySelectorAll('[data-for-step]')].map(entry => ({
    entry,
    forStep: Number(entry.dataset.forStep),
  })) : []

  const calm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }
  const model = createSessionPlaybackModel(playerData)
  const steps = model.getSteps()
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
  let curTime = 0
  let playHead = initialStep
  let prevRenderedHead = initialStep
  let selectedIdx = initialStep
  let userClickedInspect = false
  let isInitialMount = true
  let playing = false
  let stepBusy = false
  let follow = false
  let animatedHead = -2
  let animTimers = []
  let activeAnims = []
  let typingRaf = 0
  let activeCleanup = null
  let hoverCat = null
  let openCat = null
  const openItems = new Set()

  const camera = (() => {
    let targetTop = null
    let rafId = 0
    let lastTs = 0
    let userPausedFollow = false
    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
      targetTop = null
      lastTs = 0
    }
    if (chatScroll) {
      const onUserScrollGesture = () => {
        stop()
        const distFromBottom = chatScroll.scrollHeight - chatScroll.clientHeight - chatScroll.scrollTop
        userPausedFollow = distFromBottom > 48
      }
      chatScroll.addEventListener('wheel', onUserScrollGesture, { passive: true })
      chatScroll.addEventListener('touchstart', onUserScrollGesture, { passive: true })
    }
    const tick = ts => {
      if (!chatScroll || targetTop === null) {
        stop()
        return
      }
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60
      lastTs = ts
      const cur = chatScroll.scrollTop
      const maxScroll = Math.max(0, chatScroll.scrollHeight - chatScroll.clientHeight)
      const clampedTarget = Math.max(0, Math.min(maxScroll, targetTop))
      const diff = clampedTarget - cur
      if (Math.abs(diff) < 0.6 || calm.matches) {
        chatScroll.scrollTop = clampedTarget
        stop()
        return
      }
      const alpha = 1 - Math.exp(-14 * dt)
      chatScroll.scrollTop = cur + diff * alpha
      rafId = requestAnimationFrame(tick)
    }
    return {
      stop,
      resumeFollow() {
        userPausedFollow = false
      },
      scrollTo(nextTop) {
        if (!chatScroll) return
        if (calm.matches) {
          chatScroll.scrollTop = Math.max(0, nextTop)
          return
        }
        targetTop = Math.max(0, nextTop)
        if (!rafId) {
          lastTs = 0
          rafId = requestAnimationFrame(tick)
        }
      },
      followBottom() {
        if (!chatScroll || userPausedFollow) return
        const maxScroll = Math.max(0, chatScroll.scrollHeight - chatScroll.clientHeight)
        if (maxScroll - chatScroll.scrollTop > 2) {
          this.scrollTo(maxScroll)
        }
      },
      frameEntry(entry, isForward) {
        if (!chatScroll || !entry) return
        const paneRect = chatScroll.getBoundingClientRect()
        const rect = entry.getBoundingClientRect()
        const entryTop = rect.top - paneRect.top + chatScroll.scrollTop
        const entryBottom = entryTop + rect.height
        const viewTop = chatScroll.scrollTop
        const viewH = chatScroll.clientHeight
        const viewBottom = viewTop + viewH

        if (entryTop >= viewTop + 16 && entryBottom <= viewBottom - 24) return

        if (isForward && entryBottom > viewBottom - 24) {
          if (rect.height <= viewH - 52) {
            this.scrollTo(entryBottom - viewH + 28)
          } else {
            this.scrollTo(entryTop - 20)
          }
        } else if (entryTop < viewTop + 20 || !isForward) {
          this.scrollTo(entryTop - 24)
        }
      },
    }
  })()

  function clearStepAnimations() {
    animTimers.forEach(id => clearTimeout(id))
    animTimers = []
    if (typingRaf) {
      cancelAnimationFrame(typingRaf)
      typingRaf = 0
    }
    if (activeCleanup) {
      const fn = activeCleanup
      activeCleanup = null
      fn()
    }
    activeAnims.forEach(anim => {
      if (anim.playState === 'running') anim.finish()
    })
    activeAnims = []
    stepBusy = false
  }

  function updateProgressHairline(idx = playHead) {
    if (!progressBar) return
    const ratio = steps.length > 0 && idx >= 0 ? Math.max(0, Math.min(1, (idx + 0.5) / steps.length)) : 0
    progressBar.style.opacity = idx >= 0 || playing ? '1' : '0'
    progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`
  }

  function rawPromptTextOf(stepIdx) {
    const step = steps[stepIdx]
    if (!step || step.kind !== 'prompt') return ''
    const entry = stepEntries.find(e => e.stepIndex === stepIdx)?.entry
    const text = (entry?.querySelector('.session-bubble')?.textContent || step.summary || '').trim()
    return text === '（中途打断）' ? '' : text
  }

  function setComposerVisual(state, text = '') {
    if (!composer || !composerText) return
    composer.classList.toggle('is-typing', state === 'typing')
    if (state === 'draft') {
      composerText.className = 'session-composer-text'
      composerText.textContent = text
      if (stageTrigger) stageTrigger.scrollTop = 0
      if (sendBtn) {
        sendBtn.className = 'session-composer-send is-ready'
        sendBtn.textContent = '↑'
        sendBtn.disabled = false
        sendBtn.setAttribute('aria-label', t('sendThisPrompt'))
      }
    } else if (state === 'typing') {
      composerText.className = 'session-composer-text'
      composerText.innerHTML = `${escapeHtml(text)}<span class="session-cursor"></span>`
      if (stageTrigger) stageTrigger.scrollTop = stageTrigger.scrollHeight
      if (sendBtn) {
        sendBtn.className = 'session-composer-send is-ready'
        sendBtn.textContent = '↑'
        sendBtn.disabled = false
        sendBtn.setAttribute('aria-label', t('sendThisPrompt'))
      }
    } else if (state === 'running') {
      composerText.className = 'session-composer-text is-placeholder'
      composerText.textContent = t('composerPlaceholder')
      if (stageTrigger) stageTrigger.scrollTop = 0
      if (sendBtn) {
        sendBtn.className = 'session-composer-send is-stop'
        sendBtn.textContent = '■'
        sendBtn.disabled = false
        sendBtn.setAttribute('aria-label', t('pausePlayback'))
      }
    } else {
      const finished = playHead >= steps.length - 1
      composerText.className = 'session-composer-text is-placeholder'
      composerText.textContent = finished ? t('composerFinished') : t('composerPlaceholder')
      if (stageTrigger) stageTrigger.scrollTop = 0
      if (sendBtn) {
        sendBtn.className = 'session-composer-send'
        sendBtn.textContent = '↑'
        sendBtn.disabled = true
        sendBtn.setAttribute('aria-label', t('waitNextStep'))
      }
    }
  }

  function buildPrePromptStep() {
    if (playerData.initialSnapshot) {
      return {
        index: -1,
        turn: 0,
        t: 0,
        kind: 'pre-prompt',
        primaryCat: null,
        speedLabel: '1.0×',
        dwellMs: 1200,
        dimChat: false,
        summary: '',
        typewriterFrames: [],
        replyChunks: [],
        contextSnapshot: model.hydrateSnapshot(playerData.initialSnapshot),
      }
    }
    return model.selectStep(0)
  }

  function stateForIndex(idx) {
    return idx < 0 ? buildPrePromptStep() : model.selectStep(idx)
  }

  function currentSelectedState() {
    return stateForIndex(selectedIdx)
  }

  if (play) play.hidden = false
  if (log) log.classList.add('is-staged')
  if (scrubber) {
    scrubber.classList.add('is-ready')
    scrubber.removeAttribute('aria-hidden')
    Object.entries({
      role: 'slider',
      tabindex: '0',
      'aria-label': t('tlAria'),
      'aria-valuemin': '0',
      'aria-valuemax': String(Math.round(playerData.end || 1)),
    }).forEach(([key, value]) => scrubber.setAttribute(key, value))
  }

  function applyEchoHighlight() {
    if (!asidePane) return
    const activeKey = hoverCat || (userClickedInspect ? openCat : null)
    stackedBar?.classList.toggle('lc-stacked-dim', Boolean(activeKey))
    asidePane.querySelectorAll('[data-cat-key]').forEach(el => {
      const match = activeKey && el.dataset.catKey === activeKey
      el.classList.toggle('lc-stacked-seg-on', Boolean(match && el.classList.contains('lc-stacked-seg')))
      el.classList.toggle('lc-chip-on', Boolean(match && el.classList.contains('lc-chip')))
    })
    asidePane.querySelectorAll('[data-browser-cat]').forEach(el => {
      el.classList.toggle('is-echo', Boolean(hoverCat && el.dataset.browserCat === hoverCat))
    })
  }

  stepEntries.forEach(({ entry, stepIndex }) => {
    entry.addEventListener('click', event => {
      const lbBtn = event.target.closest('[data-lightbox-src]')
      if (lbBtn && lightbox && lightboxImg) {
        event.stopPropagation()
        if (playing) setPlaying(false)
        lightbox.classList.remove('is-doc')
        if (lightboxDoc) {
          lightboxDoc.hidden = true
          lightboxDoc.innerHTML = ''
        }
        lightboxImg.hidden = false
        lightboxImg.src = lbBtn.dataset.lightboxSrc
        lightboxImg.alt = lbBtn.dataset.lightboxLabel || ''
        if (lightboxTitle) lightboxTitle.textContent = lbBtn.dataset.lightboxLabel || t('lightboxDefaultTitle')
        if (typeof lightbox.showModal === 'function') lightbox.showModal()
        else lightbox.setAttribute('open', '')
        return
      }
      const docBtn = event.target.closest('[data-doc-open]')
      if (docBtn && lightbox && lightboxDoc) {
        event.stopPropagation()
        const tpl = entry.querySelector(`template[data-doc-html="${docBtn.dataset.docOpen}"]`)
        if (tpl) {
          if (playing) setPlaying(false)
          lightbox.classList.add('is-doc')
          if (lightboxImg) {
            lightboxImg.hidden = true
            lightboxImg.removeAttribute('src')
          }
          lightboxDoc.innerHTML = tpl.innerHTML
          lightboxDoc.hidden = false
          if (lightboxTitle) lightboxTitle.textContent = docBtn.dataset.docTitle || t('docModalDefaultTitle')
          if (typeof lightbox.showModal === 'function') lightbox.showModal()
          else lightbox.setAttribute('open', '')
          if (lightboxDoc.parentElement) lightboxDoc.parentElement.scrollTop = 0
        }
        return
      }
      if (event.target.closest('a, audio, video, summary, button')) return
      if (stepIndex > playHead) return
      if (playing) setPlaying(false)
      const step = steps[stepIndex]
      selectedIdx = stepIndex
      userClickedInspect = true
      openCat = step?.primaryCat || null
      follow = false
      render()
      if (openCat) {
        requestAnimationFrame(() => {
          asidePane?.querySelector(`[data-browser-cat="${openCat}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
    })
    entry.addEventListener('mouseenter', () => {
      if (stepIndex > playHead) return
      hoverCat = entry.dataset.echoCat || null
      applyEchoHighlight()
    })
    entry.addEventListener('mouseleave', () => {
      if (hoverCat) {
        hoverCat = null
        applyEchoHighlight()
      }
    })
  })

  function renderContextSidebar(stepState) {
    if (!asidePane || !stepState) return
    const snap = stepState.contextSnapshot
    if (snapLabel) {
      if (stepState.index < 0) {
        snapLabel.textContent = t('snapInitial')
      } else if (selectedIdx < playHead) {
        snapLabel.textContent = t('snapInspect', { step: stepState.index + 1, total: steps.length })
      } else {
        snapLabel.textContent = t('snapCurrent', { step: stepState.index + 1, total: steps.length })
      }
    }
    const totEl = asidePane.querySelector('[data-context-tot]')
    if (totEl) totEl.textContent = `${(snap.totalTokens / 1000).toFixed(1)}k`
    const winEl = asidePane.querySelector('[data-context-win]')
    if (winEl && snap.windowLabel) winEl.textContent = snap.windowLabel
    const pctEl = asidePane.querySelector('[data-context-pct]')
    if (pctEl) pctEl.textContent = `${snap.pct}%`

    for (const [key, val] of Object.entries(snap.segments || {})) {
      const seg = asidePane.querySelector(`[data-seg="${key}"]`)
      if (seg) seg.style.width = `${val}%`
    }

    for (const [key, val] of Object.entries(snap.tokensByKind || {})) {
      const tokEl = asidePane.querySelector(`[data-pro-tok="${key}"]`)
      if (tokEl) tokEl.textContent = `≈${(val / 1000).toFixed(1)}k`
    }

    const browserBox = asidePane.querySelector('[data-context-browser]')
    if (browserBox && Array.isArray(snap.categories)) {
      browserBox.innerHTML = snap.categories.map(cat => {
        const list = cat.items || []
        const isEmpty = list.length === 0
        const isCatOpen = !isEmpty && openCat === cat.id
        const deltaCls = String(cat.delta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
        const tokDeltaCls = String(cat.tokDelta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
        const itemsHtml = isCatOpen ? list.map(item => {
          const isItemOpen = openItems.has(item.id)
          let payloadHtml = ''
          if (isItemOpen) {
            const rawPayload = String(item.payload || '')
            const expandBtn = rawPayload.length > 220
              ? `<div class="sp-payload-bar"><span>${rawPayload.length.toLocaleString()} chars · ${escapeHtml(item.meta || '')}</span><button type="button" class="sp-payload-expand" data-ctx-modal="${escapeHtml(item.id)}">${escapeHtml(t('viewFullPayload'))}</button></div>`
              : ''
            const thumbsHtml = item.images?.length
              ? `<span class="session-thumbs">${item.images.map(name => `<a href="${escapeHtml(name)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(name)}" alt="" width="88" loading="lazy"></a>`).join('')}</span>`
              : ''
            payloadHtml = `<div class="lc-br-content session-browser-payload">${expandBtn}<pre class="sp-payload-pre">${escapeHtml(rawPayload)}</pre>${thumbsHtml}</div>`
          }
          return `<div class="lc-br-elem session-browser-item${isItemOpen ? ' lc-br-elem-on' : ''}${item.isNew ? ' is-new' : ''}" data-browser-item="${escapeHtml(item.id)}">
            <button type="button" class="lc-br-elem-row session-browser-item-btn" data-browser-item-toggle="${escapeHtml(item.id)}" aria-expanded="${isItemOpen ? 'true' : 'false'}">
              <span class="lc-br-chev${isItemOpen ? ' lc-br-chev-on' : ''}"></span>
              ${item.tag ? `<span class="lc-br-tag">${escapeHtml(item.tag)}</span>` : ''}
              <span class="lc-br-preview session-browser-item-title">${escapeHtml(item.title)}</span>
              <span class="session-browser-item-meta"><span class="lc-br-time">${escapeHtml(item.meta || '')}</span></span>
            </button>
            ${payloadHtml}
          </div>`
        }).join('') : ''
        return `<div class="lc-br-cat session-browser-cat${isEmpty ? ' is-empty' : ''}${hoverCat === cat.id ? ' is-echo' : ''}" data-browser-cat="${escapeHtml(cat.id)}">
          <button type="button" class="lc-br-cat-row${isCatOpen ? ' lc-br-cat-open' : ''} session-browser-cat-btn" data-browser-cat-toggle="${escapeHtml(cat.id)}" aria-expanded="${isCatOpen ? 'true' : 'false'}"${isEmpty ? ' disabled' : ''}>
            <span class="lc-br-chev${isCatOpen ? ' lc-br-chev-on' : ''}"></span>
            <span class="lc-br-count-grp">
              <i class="session-cat-dot is-${escapeHtml(cat.color || cat.id)}"></i>
              <span class="lc-br-cat-label">${escapeHtml(cat.name)}</span>
              <span class="lc-br-cat-count">${escapeHtml(cat.count)}</span>
              ${cat.delta ? `<b class="lc-br-delta ${deltaCls} session-delta-badge">${escapeHtml(cat.delta)}</b>` : ''}
            </span>
            <span class="lc-br-tokens-grp">
              ${cat.tokDelta ? `<b class="lc-br-delta ${tokDeltaCls}">${escapeHtml(cat.tokDelta)}</b>` : ''}
              <span class="lc-br-tokens">${escapeHtml(cat.tok)}</span>
            </span>
          </button>
          <div class="lc-br-body session-browser-items"${isCatOpen ? '' : ' hidden'}>
            ${isCatOpen ? (itemsHtml || `<p class="session-ctx-empty">${escapeHtml(t('emptyCategory'))}</p>`) : ''}
          </div>
        </div>`
      }).join('')
    }
    applyEchoHighlight()
  }

  asidePane?.addEventListener('mouseover', event => {
    const catEl = event.target.closest('[data-cat-key], [data-browser-cat]')
    const nextKey = catEl ? (catEl.dataset.catKey || catEl.dataset.browserCat) : null
    if (nextKey !== hoverCat) {
      hoverCat = nextKey
      applyEchoHighlight()
    }
  })
  asidePane?.addEventListener('mouseleave', () => {
    if (hoverCat) {
      hoverCat = null
      applyEchoHighlight()
    }
  })

  const closeLightbox = () => {
    if (!lightbox) return
    if (typeof lightbox.close === 'function' && lightbox.open) lightbox.close()
    else lightbox.removeAttribute('open')
  }
  lightboxClose?.addEventListener('click', closeLightbox)
  lightbox?.addEventListener('click', event => {
    if (event.target === lightbox) closeLightbox()
  })

  function renderTimelineHover(idx) {
    if (!tlPop) return
    if (idx === null || idx < 0 || idx >= steps.length) {
      tlPop.hidden = true
      return
    }
    const s = steps[idx]
    const pct = steps.length > 0 ? Math.min(88, Math.max(12, ((idx + 0.5) / steps.length) * 100)) : 50
    const frame = s.frames?.[0]
    const doc = s.docs?.[0]
    const ci = s.compactInfo
    const thumbHtml = frame
      ? `<span class="session-tl-pop-thumb"><img src="${escapeHtml(frame.img)}" alt=""></span>`
      : ''
    const headTitle = ci
      ? t('tlCompressTitle', { seq: ci.seq, dropped: ((ci.droppedTokens || 0) / 1000).toFixed(0) })
      : frame
        ? `🖼 ${frame.label}`
        : doc
          ? `📄 ${doc.title}`
          : s.kind === 'prompt'
            ? t('tlPromptTitle', { turn: s.turn, summary: shorten(s.summary || '', 20) })
            : shorten(s.summary || t('tlStepFallback'), 24)
    const tokStr = `${((s.contextSnapshot?.totalTokens || 0) / 1000).toFixed(1)}k`
    tlPop.style.left = `${pct.toFixed(1)}%`
    tlPop.innerHTML = `${thumbHtml}<span class="session-tl-pop-meta"><small>${escapeHtml(t('tlStepMeta', { step: idx + 1, time: elapsedClock(s.t) }))}</small><b>${escapeHtml(headTitle)}</b><span>Context ≈${escapeHtml(tokStr)}</span></span>`
    tlPop.hidden = false
  }

  function jumpViaTimeline(idx) {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx))
    if (playing) setPlaying(false)
    activate()
    if (clamped > playHead) {
      clearStepAnimations()
      playHead = clamped
      prevRenderedHead = clamped
      animatedHead = clamped
      selectedIdx = clamped
      userClickedInspect = false
      openCat = steps[clamped]?.primaryCat || null
      const next = steps[playHead + 1]
      const nextDraft = next?.kind === 'prompt' ? rawPromptTextOf(next.index) : ''
      if (nextDraft) setComposerVisual('draft', nextDraft)
      else setComposerVisual('idle')
      follow = true
      render()
    } else {
      selectedIdx = clamped
      userClickedInspect = clamped < playHead
      openCat = steps[clamped]?.primaryCat || null
      follow = false
      render()
      const targetEntry = stepEntries.find(e => e.stepIndex === clamped)?.entry
      if (targetEntry) camera.frameEntry(targetEntry, false)
    }
  }

  tlTrack?.addEventListener('mouseover', event => {
    const h = event.target.closest('[data-tl-hover]')
    renderTimelineHover(h ? Number(h.dataset.tlHover) : null)
  })
  tlTrack?.addEventListener('mouseleave', () => renderTimelineHover(null))
  tlTrack?.addEventListener('click', event => {
    const el = event.target.closest('[data-tl-jump], [data-tl-step]')
    if (!el) return
    const idx = Number(el.dataset.tlJump ?? el.dataset.tlStep)
    if (Number.isFinite(idx)) jumpViaTimeline(idx)
  })

  asidePane?.addEventListener('click', event => {
    const modalBtn = event.target.closest('[data-ctx-modal]')
    if (modalBtn && lightbox && lightboxDoc) {
      const rec = (playerData.contextRecords || {})[modalBtn.dataset.ctxModal]
      if (rec) {
        if (playing) setPlaying(false)
        lightbox.classList.add('is-doc')
        if (lightboxImg) {
          lightboxImg.hidden = true
          lightboxImg.removeAttribute('src')
        }
        const imgs = rec.images?.length
          ? `<div class="session-thumbs">${rec.images.map(src => `<img src="${escapeHtml(src)}" alt="" style="max-width:100%;border-radius:6px">`).join('')}</div>`
          : ''
        lightboxDoc.innerHTML = `<pre class="sp-modal-pre">${escapeHtml(String(rec.payload || ''))}</pre>${imgs}`
        lightboxDoc.hidden = false
        if (lightboxTitle) lightboxTitle.textContent = `${rec.tag ? `[${rec.tag}] ` : ''}${rec.title}`
        if (typeof lightbox.showModal === 'function') lightbox.showModal()
        else lightbox.setAttribute('open', '')
        if (lightboxDoc.parentElement) lightboxDoc.parentElement.scrollTop = 0
      }
      return
    }
    const chipOrSeg = event.target.closest('[data-cat-key]')
    if (chipOrSeg) {
      const catId = chipOrSeg.dataset.catKey
      openCat = openCat === catId ? null : catId
      renderContextSidebar(currentSelectedState())
      asidePane.querySelector(`[data-browser-cat="${catId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    const catBtn = event.target.closest('[data-browser-cat-toggle]')
    if (catBtn && !catBtn.disabled) {
      const catId = catBtn.dataset.browserCatToggle
      openCat = openCat === catId ? null : catId
      renderContextSidebar(currentSelectedState())
      return
    }
    const itemBtn = event.target.closest('[data-browser-item-toggle]')
    if (itemBtn) {
      const itemId = itemBtn.dataset.browserItemToggle
      if (openItems.has(itemId)) openItems.delete(itemId)
      else openItems.add(itemId)
      renderContextSidebar(currentSelectedState())
    }
  })

  function typeComposerDraft(text, onDone) {
    const clean = String(text || '').trim()
    if (!clean || calm.matches) {
      setComposerVisual('draft', clean)
      if (onDone) onDone()
      return
    }
    stepBusy = true
    const charsPerSec = clean.length > 120 ? Math.min(95, 48 + (clean.length - 120) * 0.22) : 44
    let idx = 0
    activeCleanup = () => {
      setComposerVisual('draft', clean)
    }
    const stepChar = () => {
      idx = Math.min(clean.length, idx + 1)
      if (idx < clean.length) {
        setComposerVisual('typing', clean.slice(0, idx))
        const ch = clean[idx - 1] || ''
        const pause = clean.length <= 160 ? (ch === '。' || ch === '？' || ch === '\n' ? 75 : ch === '，' || ch === '：' ? 32 : 0) : 0
        animTimers.push(setTimeout(stepChar, 1000 / charsPerSec + pause))
      } else {
        activeCleanup = null
        stepBusy = false
        setComposerVisual('draft', clean)
        if (onDone) onDone()
      }
    }
    stepChar()
  }

  function runToolMontage(headState, headEntry, onDone) {
    const montageEl = headEntry?.querySelector('[data-montage-row]')
    const detailsEl = headEntry?.querySelector('[data-process-details]')
    const frameDeckEl = headEntry?.querySelector('[data-frame-deck]')
    const frames = headState.montageFrames || []
    if (!montageEl || !detailsEl || !frames.length || calm.matches) {
      if (onDone) onDone()
      return
    }
    stepBusy = true
    setComposerVisual('running')
    detailsEl.hidden = true
    if (frameDeckEl) frameDeckEl.hidden = true
    montageEl.hidden = false
    activeCleanup = () => {
      montageEl.hidden = true
      montageEl.innerHTML = ''
      detailsEl.hidden = false
      if (frameDeckEl) frameDeckEl.hidden = false
    }
    let idx = 0
    const nextCut = () => {
      if (idx < frames.length) {
        const f = frames[idx++]
        montageEl.innerHTML = `<span class="dsh-proc-dot is-live"></span><span class="session-montage-speed${f.isSpot ? ' is-spot' : ''}">${escapeHtml(f.speed)}</span><span class="dsh-shimmer-text">${escapeHtml(f.tag)} · ${escapeHtml(f.title)}</span>`
        camera.followBottom()
        animTimers.push(setTimeout(nextCut, f.isSpot ? 620 : 250))
      } else {
        activeCleanup = null
        stepBusy = false
        montageEl.hidden = true
        montageEl.innerHTML = ''
        detailsEl.hidden = false
        if (frameDeckEl) {
          frameDeckEl.hidden = false
          if (typeof frameDeckEl.animate === 'function') {
            activeAnims.push(frameDeckEl.animate(
              [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 260, easing: EASE_OUT }
            ))
          }
          camera.followBottom()
        }
        if (onDone) onDone()
      }
    }
    nextCut()
  }

  function streamRichReply(headEntry, onDone) {
    const body = headEntry?.querySelector('.session-ai-body')
    if (!body || calm.matches) {
      if (onDone) onDone()
      return
    }
    const fullHtml = body.dataset.fullHtml || (body.dataset.fullHtml = body.innerHTML)
    body.innerHTML = fullHtml

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    const segs = []
    let totalChars = 0
    let node
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue || ''
      if (!txt.trim() && !txt.includes(' ')) continue
      const ancestors = []
      for (let el = node.parentElement; el && el !== body; el = el.parentElement) {
        ancestors.push(el)
      }
      segs.push({ node, full: txt, start: totalChars, end: totalChars + txt.length, ancestors, revealed: false })
      totalChars += txt.length
    }
    if (totalChars < 2) {
      if (onDone) onDone()
      return
    }

    stepBusy = true
    setComposerVisual('running')
    const hiddenEls = new Set()
    for (const seg of segs) {
      seg.node.nodeValue = ''
      for (const el of seg.ancestors) {
        if (!hiddenEls.has(el)) {
          hiddenEls.add(el)
          el.style.display = 'none'
        }
      }
    }
    const leadSpan = document.createElement('span')
    leadSpan.className = 'session-soft-lead'

    activeCleanup = () => {
      leadSpan.remove()
      body.innerHTML = fullHtml
    }

    const baseCps = totalChars > 480 ? Math.min(115, 48 + (totalChars - 480) * 0.09) : 44
    const stride = totalChars > 700 ? 2 : 1
    let cursor = 0
    let segPtr = 0

    const tickStream = () => {
      cursor = Math.min(totalChars, cursor + stride)
      while (segPtr < segs.length && segs[segPtr].end < cursor) {
        const doneSeg = segs[segPtr]
        if (!doneSeg.revealed) {
          doneSeg.revealed = true
          for (const el of doneSeg.ancestors) el.style.display = ''
        }
        doneSeg.node.nodeValue = doneSeg.full
        segPtr++
      }
      let lastChar = ''
      if (segPtr < segs.length && cursor > segs[segPtr].start) {
        const curSeg = segs[segPtr]
        if (!curSeg.revealed) {
          curSeg.revealed = true
          for (const el of curSeg.ancestors) el.style.display = ''
        }
        const localLen = cursor - curSeg.start
        const slice = curSeg.full.slice(0, localLen)
        lastChar = slice[slice.length - 1] || ''
        if (cursor < totalChars && slice.length >= 2) {
          const tailLen = Math.min(3, slice.length)
          curSeg.node.nodeValue = slice.slice(0, slice.length - tailLen)
          leadSpan.textContent = slice.slice(slice.length - tailLen)
          if (curSeg.node.nextSibling !== leadSpan) {
            curSeg.node.parentNode?.insertBefore(leadSpan, curSeg.node.nextSibling)
          }
        } else {
          curSeg.node.nodeValue = slice
        }
      }
      camera.followBottom()
      if (cursor < totalChars) {
        const pause = totalChars <= 600
          ? (lastChar === '。' || lastChar === '！' || lastChar === '？' || lastChar === '\n' ? 95 : lastChar === '，' || lastChar === '、' || lastChar === '：' ? 38 : 0)
          : 0
        animTimers.push(setTimeout(tickStream, (1000 / baseCps) * stride + pause))
      } else {
        activeCleanup = null
        stepBusy = false
        leadSpan.remove()
        body.innerHTML = fullHtml
        camera.followBottom()
        if (onDone) onDone()
      }
    }
    tickStream()
  }

  function preparePostStepComposerAndContinue() {
    const immediateNext = steps[playHead + 1]
    if (!immediateNext) {
      setComposerVisual('idle')
      if (playing) setPlaying(false)
      return
    }
    if (immediateNext.kind === 'prompt') {
      const draft = rawPromptTextOf(immediateNext.index)
      if (!draft) {
        setComposerVisual('idle')
        if (playing) {
          animTimers.push(setTimeout(() => {
            if (playing) goToStage(playHead + 1, true)
          }, 260))
        }
        return
      }
      if (isInitialMount) {
        setComposerVisual('draft', draft)
        return
      }
      const beat = playHead < 0 ? 0 : 380
      animTimers.push(setTimeout(() => {
        typeComposerDraft(draft, () => {
          if (playing) {
            animTimers.push(setTimeout(() => {
              if (playing) goToStage(playHead + 1, true)
            }, 240))
          }
        })
      }, beat))
      return
    }
    setComposerVisual(playing ? 'running' : 'idle')
    if (playing) {
      animTimers.push(setTimeout(() => {
        if (playing) goToStage(playHead + 1, true)
      }, 360))
    }
  }

  function runHeadChoreography(headState, headEntry, animateNewStep, steppedForwardOne) {
    updateProgressHairline()
    if (!animateNewStep) return
    clearStepAnimations()

    if (playHead < 0) {
      preparePostStepComposerAndContinue()
      return
    }

    if (!steppedForwardOne) {
      const next = steps[playHead + 1]
      const nextDraft = next?.kind === 'prompt' ? rawPromptTextOf(next.index) : ''
      if (nextDraft) setComposerVisual('draft', nextDraft)
      else setComposerVisual('idle')
      return
    }

    if (headState.kind === 'prompt') {
      setComposerVisual(steps[playHead + 1] && steps[playHead + 1].kind !== 'prompt' ? 'running' : 'idle')
      if (headEntry && !calm.matches && typeof headEntry.animate === 'function') {
        const bubble = headEntry.querySelector('.session-bubble') || headEntry
        activeAnims.push(bubble.animate(
          [
            { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 260, easing: EASE_OUT }
        ))
      }
      camera.followBottom()
      preparePostStepComposerAndContinue()
      return
    }

    if (headState.kind === 'fast-tools' || headState.kind === 'spotlight-change') {
      runToolMontage(headState, headEntry, () => {
        preparePostStepComposerAndContinue()
      })
      return
    }

    if (headState.kind === 'compact') {
      setComposerVisual('running')
      openCat = 'tool'
      renderContextSidebar(currentSelectedState())
      if (headEntry && !calm.matches && typeof headEntry.animate === 'function') {
        activeAnims.push(headEntry.animate(
          [
            { opacity: 0, transform: 'translateY(8px) scale(0.99)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 320, easing: EASE_OUT }
        ))
      }
      camera.followBottom()
      animTimers.push(setTimeout(() => {
        preparePostStepComposerAndContinue()
      }, 900))
      return
    }

    if (headState.kind === 'reply') {
      streamRichReply(headEntry, () => {
        preparePostStepComposerAndContinue()
      })
      return
    }

    preparePostStepComposerAndContinue()
  }

  function render() {
    const headState = stateForIndex(playHead)
    const selectedState = currentSelectedState()
    curTime = headState.index < 0 ? 0 : headState.t
    const x = (playerData.end > 0 ? ((curTime / playerData.end) * width) : 0).toFixed(1)
    if (head) {
      head.setAttribute('x1', x)
      head.setAttribute('x2', x)
    }
    if (scrubber) {
      scrubber.setAttribute('aria-valuenow', String(Math.round(curTime)))
      scrubber.setAttribute('aria-valuetext', wallClock(playerData.start, curTime))
    }

    if (emptyStage) emptyStage.hidden = playHead >= 0
    if (prevBtn) prevBtn.disabled = playHead <= -1
    if (nextBtn) nextBtn.disabled = playHead >= steps.length - 1
    if (play && !playing) {
      const atEnd = playHead >= steps.length - 1
      play.textContent = atEnd ? t('replay') : t('play')
      play.setAttribute('aria-label', atEnd ? t('replayAria') : t('playAria'))
    }

    renderContextSidebar(selectedState)
    const shownIdx = userClickedInspect && selectedIdx >= 0 ? selectedIdx : playHead
    const shownTime = shownIdx < 0 ? 0 : (steps[shownIdx]?.t || 0)
    updateProgressHairline(shownIdx)
    if (speedBadge) {
      speedBadge.innerHTML = `<b>${Math.max(0, shownIdx + 1)}</b> / ${steps.length} · ${elapsedClock(shownTime)}`
    }
    tlSegs.forEach((seg, idx) => {
      seg.classList.toggle('is-past', idx <= playHead && idx !== shownIdx)
      seg.classList.toggle('is-active', idx === shownIdx && shownIdx >= 0)
    })
    tlPins.forEach(pin => {
      const pIdx = Number(pin.dataset.tlJump)
      pin.classList.toggle('is-on', pIdx === shownIdx && shownIdx >= 0)
      pin.classList.toggle('is-reached', pIdx <= playHead)
    })

    let latestVisibleEntry
    for (const item of stepEntries) {
      const future = item.stepIndex > playHead
      item.entry.classList.toggle('is-future', future)
      const isInspectSelected = !future && userClickedInspect && item.stepIndex === selectedIdx
      item.entry.classList.toggle('is-selected', isInspectSelected)

      let tag = item.entry.querySelector('.session-inspect-tag')
      if (isInspectSelected) {
        if (!tag) {
          tag = document.createElement('span')
          tag.className = 'session-inspect-tag'
          item.entry.prepend(tag)
        }
        const stTime = steps[selectedIdx]?.t || 0
        tag.textContent = t.lang === 'en'
          ? `Snapshot #${selectedIdx + 1} · ${elapsedClock(stTime)}`
          : `快照 #${selectedIdx + 1} · ${elapsedClock(stTime)}`
      } else if (tag) {
        tag.remove()
      }

      if (!future) latestVisibleEntry = item.entry
    }
    for (const aux of auxEntries) {
      aux.entry.classList.toggle('is-future', aux.forStep > playHead)
    }

    const steppedForwardOne = !isInitialMount && playHead === prevRenderedHead + 1 && playHead >= 0
    const isForwardMove = playHead >= prevRenderedHead
    prevRenderedHead = playHead

    const isNewHead = playHead !== animatedHead
    if (isNewHead) animatedHead = playHead
    const headEntry = stepEntries.find(item => item.stepIndex === playHead)?.entry
    runHeadChoreography(headState, headEntry, isNewHead, steppedForwardOne)

    if (latestVisibleEntry && (playing || follow)) {
      camera.frameEntry(latestVisibleEntry, isForwardMove)
    } else if (playHead < 0 && chatScroll && follow) {
      camera.scrollTo(0)
    }
    follow = false
  }

  function activate() {
    root?.classList.add('is-active')
  }
  function goToStage(nextIdx, shouldScroll = true) {
    activate()
    if (shouldScroll) camera.resumeFollow()
    playHead = Math.max(-1, Math.min(steps.length - 1, nextIdx))
    selectedIdx = playHead
    userClickedInspect = false
    openCat = playHead < 0 ? null : (steps[playHead]?.primaryCat || null)
    follow = shouldScroll
    animatedHead = -2
    render()
  }
  function seek(time, shouldScroll = true) {
    const idx = steps.findLastIndex(step => step.t <= time)
    goToStage(idx < 0 ? 0 : idx, shouldScroll)
  }
  function setPlaying(value) {
    playing = value
    const atEnd = playHead >= steps.length - 1
    if (play) {
      play.textContent = playing ? t('pause') : atEnd ? t('replay') : t('play')
      play.setAttribute('aria-label', playing ? t('pauseAria') : atEnd ? t('replayAria') : t('playAria'))
    }
    if (!playing) {
      camera.stop()
      clearStepAnimations()
      const next = steps[playHead + 1]
      const nextDraft = next?.kind === 'prompt' ? rawPromptTextOf(next.index) : ''
      if (nextDraft) setComposerVisual('draft', nextDraft)
      else setComposerVisual('idle')
      updateProgressHairline()
      return
    }
    activate()
    camera.resumeFollow()
    if (playHead >= steps.length - 1) {
      clearStepAnimations()
      playHead = -1
      prevRenderedHead = -1
      selectedIdx = -1
      userClickedInspect = false
      openCat = null
      follow = true
      animatedHead = -1
      render()
    }
    if (selectedIdx < playHead) {
      selectedIdx = playHead
      userClickedInspect = false
      openCat = steps[playHead]?.primaryCat || null
      render()
    }
    if (!stepBusy) {
      if (playHead < 0) {
        const firstDraft = steps[0]?.kind === 'prompt' ? rawPromptTextOf(0) : ''
        if (firstDraft) {
          typeComposerDraft(firstDraft, () => {
            if (playing) {
              animTimers.push(setTimeout(() => {
                if (playing) goToStage(0, true)
              }, 220))
            }
          })
        } else {
          goToStage(0, true)
        }
      } else {
        goToStage(playHead + 1, true)
      }
    }
  }

  play?.addEventListener('click', () => setPlaying(!playing))
  prevBtn?.addEventListener('click', () => {
    setPlaying(false)
    goToStage(playHead - 1, true)
  })
  nextBtn?.addEventListener('click', () => {
    setPlaying(false)
    goToStage(playHead + 1, true)
  })
  sendBtn?.addEventListener('click', event => {
    event.stopPropagation()
    if (playing || stepBusy) {
      setPlaying(false)
      return
    }
    if (playHead + 1 < steps.length) {
      goToStage(playHead + 1, true)
    }
  })
  stageTrigger?.addEventListener('click', () => {
    if (playing || stepBusy) return
    if (steps[playHead + 1]?.kind === 'prompt') {
      goToStage(playHead + 1, true)
    }
  })
  langToggleBtn?.addEventListener('click', () => {
    setPlaying(false)
    if (onToggleLang) {
      onToggleLang(t.lang === 'zh' ? 'en' : 'zh', playHead)
    }
  })

  const onKeyDown = event => {
    if (lightbox?.open || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest('input, textarea, select, a, audio, video, summary, [contenteditable]')) return
    if (event.key === ' ' && event.target.closest('button')) return
    if (event.key === 'ArrowLeft') {
      setPlaying(false)
      goToStage(playHead - 1, true)
    } else if (event.key === 'ArrowRight') {
      setPlaying(false)
      goToStage(playHead + 1, true)
    } else if (event.key === ' ') {
      setPlaying(!playing)
    } else {
      return
    }
    event.preventDefault()
  }
  if (!appEl.hasAttribute('tabindex')) appEl.tabIndex = -1
  appEl.addEventListener('keydown', onKeyDown)

  if (scrubber) {
    const fromPointer = event => {
      const box = scrubber.getBoundingClientRect()
      seek(((event.clientX - box.left) / box.width) * playerData.end)
    }
    scrubber.addEventListener('pointerdown', event => {
      scrubber.setPointerCapture(event.pointerId)
      fromPointer(event)
    })
    scrubber.addEventListener('pointermove', event => {
      if (scrubber.hasPointerCapture(event.pointerId)) fromPointer(event)
    })
  }

  if (steps.length) {
    goToStage(initialStep, initialStep >= 0)
    isInitialMount = false
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => appEl?.classList.add('is-ready'))
    } else {
      appEl?.classList.add('is-ready')
    }
  }

  return {
    destroy() {
      clearStepAnimations()
      camera.stop()
      appEl.removeEventListener('keydown', onKeyDown)
    },
    goToStage,
    setPlaying,
    getPlayHead: () => playHead,
  }
}

export async function createEncorePlayer(targetEl, sourceOrSession, options = {}) {
  const el = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl
  if (!el) throw new Error('Target element for EncorePlayer not found')

  let session = sourceOrSession
  let baseUrl = options.baseUrl || ''
  if (!session && el.getAttribute('src')) {
    sourceOrSession = el.getAttribute('src')
  }
  const preRenderedData = !session && !sourceOrSession
    ? el.querySelector('[data-encore-session-data], #session-data')
    : null
  if (preRenderedData) {
    document.documentElement.classList.add('js-session')
    el.classList.add('session-wrap')
    el.querySelector('[data-encore-lang-toggle]')?.remove()
    const appNode = el.querySelector('.session-app')
    const activeLang = resolveLang(options.lang || el.dataset.lang || appNode?.dataset.encoreLang || 'zh')
    const playerData = JSON.parse(preRenderedData.textContent)
    const activeController = attachPlayerController(el, playerData, {
      lang: activeLang,
      initialStep: options.initialStep ?? -1,
    })
    return {
      setLang: () => {},
      getController: () => activeController,
    }
  }
  if (typeof sourceOrSession === 'string') {
    const srcUrl = sourceOrSession
    if (!baseUrl) {
      const slashIdx = srcUrl.lastIndexOf('/')
      baseUrl = slashIdx >= 0 ? srcUrl.slice(0, slashIdx + 1) : './'
    }
    let loaded = null
    try {
      const res = await fetch(srcUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      loaded = await res.json()
    } catch (err) {
      const fallbackScript = document.getElementById('encore-session-fallback') || el.querySelector('[data-encore-fallback]')
      if (fallbackScript) {
        loaded = JSON.parse(fallbackScript.textContent)
      } else {
        throw err
      }
    }
    session = loaded
  }

  document.documentElement.classList.add('js-session')
  el.classList.add('session-wrap')

  const attrLang = el.dataset.lang && el.dataset.lang !== 'auto' ? el.dataset.lang : undefined
  let activeLang = resolveLang(options.lang || attrLang || session.lang)
  let activeController = null

  const mountWithLang = (lang, preserveStep = -1) => {
    if (activeController) activeController.destroy()
    activeLang = resolveLang(lang)
    const line = timeline(session, { lang: activeLang })
    el.innerHTML = renderPlayerWidget(session, line, { lang: activeLang, baseUrl })
    if (session.title && document.querySelectorAll('[data-encore-player]').length <= 1) {
      document.title = `${session.title} · Encore`
    }
    const dataScript = el.querySelector('[data-encore-session-data]')
    const playerData = dataScript ? JSON.parse(dataScript.textContent) : buildPlayerData(session, line, { baseUrl })
    activeController = attachPlayerController(el, playerData, {
      lang: activeLang,
      initialStep: preserveStep,
      onToggleLang: (nextLang, curStep) => mountWithLang(nextLang, curStep),
    })
  }

  mountWithLang(activeLang, options.initialStep ?? -1)
  return {
    setLang: nextLang => mountWithLang(nextLang, activeController ? activeController.getPlayHead() : -1),
    getController: () => activeController,
  }
}

export async function autoMountEncorePlayers() {
  if (typeof document === 'undefined') return
  const nodes = [...document.querySelectorAll('[data-encore-player]')]
  for (const node of nodes) {
    if (node.dataset.encoreMounted) continue
    node.dataset.encoreMounted = '1'
    try {
      await createEncorePlayer(node)
    } catch (err) {
      node.innerHTML = `<div class="encore-load-error">Failed to load session replay: ${escapeHtml(err.message || String(err))}</div>`
    }
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.createSessionPlaybackModel = createSessionPlaybackModel
  globalThis.EncorePlayer = {
    create: createEncorePlayer,
    attach: attachPlayerController,
    mountAll: autoMountEncorePlayers,
    createSessionPlaybackModel,
  }
}

import { createTranslator } from './i18n.mjs'
import { escapeHtml as escape, renderMarkdown } from './markdown.mjs'
import { binSeconds, describeStats, minutes, sumStats, timeline } from './timeline.mjs'

const toolLabels = {
  codex: 'Codex',
  workbuddy: 'WorkBuddy',
  'claude-code': 'Claude Code',
  'claude-ai': 'Claude',
}

const short = (text, length) => {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim()
  return line.length > length ? `${line.slice(0, length)}…` : line
}

const localLinks = text => String(text ?? '')
  .replace(/!\[[^\]]*\]\((?!https?:)[^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1')

const plain = text => localLinks(text)
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/\*\*|__|`/g, '')

const imageMark = /\[(?:附图|图片)\]/g
const unmarked = text => String(text ?? '').replace(imageMark, '').replace(/\n{3,}/g, '\n\n').trim()
const fixed = number => Number(Number(number || 0).toFixed(1))
const validVideo = /\.(mp4|webm|mov)$/i

export function wallClock(start, seconds = 0, withSeconds = false) {
  const baseMs = Date.parse(start)
  if (!Number.isFinite(baseMs)) return elapsedClock(seconds)
  return new Date(baseMs + seconds * 1000).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  })
}

export function elapsedClock(seconds = 0) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rem = s % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(rem)}` : `${pad(m)}:${pad(rem)}`
}

function resolveAsset(src, baseUrl = '') {
  if (!src) return ''
  if (/^(?:https?:|data:|blob:|\/)/i.test(src)) return src
  if (!baseUrl || baseUrl === '.' || baseUrl === './') return src
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${prefix}${String(src).replace(/^\.\//, '')}`
}

function scrubber(line, idSuffix = 'main') {
  const width = 1040
  const height = 46
  const base = 40
  const end = Math.max(1, line.end || 1)
  const x = seconds => fixed((seconds / end) * width)
  const peak = Math.max(1, ...(line.bins || [1]))
  const id = `scrub-${idSuffix}`
  const marks = [
    `<defs><pattern id="${escape(id)}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" class="sessions-hatch"/></pattern></defs>`,
    ...(line.waits || []).map(wait => `<rect x="${x(wait.s)}" y="${base - 24}" width="${fixed(x(wait.e) - x(wait.s))}" height="24" fill="url(#${escape(id)})"/>`),
    ...(line.bins || []).map((count, index) => {
      const barHeight = count ? fixed(3 + (count / peak) * 21) : 1
      return `<rect x="${fixed(x(index * binSeconds) + 0.5)}" y="${fixed(base - barHeight)}" width="${Math.max(1, fixed(x(binSeconds) - 1.5))}" height="${barHeight}" class="${count ? 'session-busy' : 'session-idle'}"/>`
    }),
    ...(line.items || []).filter(item => item.type === 'user').map(item => `<circle cx="${x(item.t)}" cy="6" r="4" class="sessions-you"/>`),
    `<line x1="0" x2="0" y1="0" y2="${height}" class="session-playhead"/>`,
  ]
  return `<svg class="session-scrubber" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${marks.join('')}</svg>`
}

const isWide = frames => (frames || []).filter(frame => frame.w > frame.h).length * 2 > (frames || []).length

function thumbs(names, baseUrl = '') {
  if (!names?.length) return ''
  return `<span class="session-thumbs">${names.map(name => {
    const url = escape(resolveAsset(name, baseUrl))
    return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="" width="96" loading="lazy"></a>`
  }).join('')}</span>`
}

function clips(audio, baseUrl = '') {
  if (!audio?.length) return ''
  return `<ul class="session-audio">${audio.map(clip => (
    `<li><span>${escape(clip.label)}</span><audio controls preload="none" src="${escape(resolveAsset(clip.src, baseUrl))}"></audio></li>`
  )).join('')}</ul>`
}

function renderStepArtifacts(stepMeta, { skipImages = [], renderMd, t, baseUrl = '' } = {}) {
  const frames = (stepMeta?.frames || []).filter(fr => !skipImages.includes(fr.img))
  const docs = stepMeta?.docs || []
  const subagents = stepMeta?.subagents || []
  const audios = stepMeta?.audios || []
  if (!frames.length && !docs.length && !subagents.length && !audios.length) return ''

  const subagentHtml = subagents.length
    ? `<div class="session-subagent-strip">${subagents.map(sa => {
      const inner = `<span class="session-sub-dot is-${escape(sa.state)}"></span><span class="session-sub-name">${escape(sa.label)}</span><em class="session-sub-badge is-${escape(sa.state)}">${escape(sa.badge)}</em>`
      if (sa.report && renderMd) {
        return `<button type="button" class="session-subagent-pill is-clickable" data-doc-open="${escape(sa.id)}" data-doc-title="${escape(t('subagentReportTitle', { label: sa.label }))}">${inner}<b>${escape(t('viewReport'))}</b></button><template data-doc-html="${escape(sa.id)}">${renderMd(sa.report)}</template>`
      }
      return `<span class="session-subagent-pill">${inner}</span>`
    }).join('')}</div>`
    : ''

  const frameCards = frames.map(fr => {
    const isPortrait = fr.w && fr.h ? fr.h > fr.w : true
    const eyebrow = fr.who === 'you' ? t('refFrameEyebrow') : t('aiFrameEyebrow')
    const imgUrl = escape(resolveAsset(fr.img, baseUrl))
    return `<button type="button" class="session-frame-card${isPortrait ? '' : ' is-wide'}" data-lightbox-src="${imgUrl}" data-lightbox-label="${escape(fr.label)}">
      <span class="session-frame-thumb"><img src="${imgUrl}" alt="${escape(fr.label)}" loading="lazy"></span>
      <span class="session-frame-meta">
        <span class="session-frame-eyebrow">${escape(eyebrow)}</span>
        <b class="session-frame-title">${escape(fr.label)}</b>
        <small class="session-frame-sub">${escape(t('frameSub', { time: elapsedClock(fr.t) }))}</small>
      </span>
    </button>`
  }).join('')

  const docCards = docs.map(doc => {
    const kb = Math.max(0.1, Math.round((doc.chars || 0) / 100) / 10)
    const tpl = renderMd ? `<template data-doc-html="${escape(doc.id)}">${renderMd(doc.content || '')}</template>` : ''
    return `<button type="button" class="session-doc-card" data-doc-open="${escape(doc.id)}" data-doc-title="${escape(doc.title)} (${escape(doc.file)})">
      <span class="session-doc-icon" aria-hidden="true">MD</span>
      <span class="session-frame-meta">
        <span class="session-doc-eyebrow">${escape(t('docEyebrow', { file: doc.file }))}</span>
        <b class="session-frame-title">${escape(doc.title)}</b>
        <small class="session-frame-sub">${escape(t('docSub', { time: elapsedClock(doc.t), kb }))}</small>
      </span>
    </button>${tpl}`
  }).join('')

  const audioCard = audios.length
    ? `<div class="session-audio-card">
      <span class="session-audio-eyebrow">${escape(t('audioEyebrow', { count: audios.length }))}</span>
      <ul class="session-audio-inline">${audios.map(clip => (
        `<li><span>${escape(clip.label)}</span><audio controls preload="none" src="${escape(resolveAsset(clip.src, baseUrl))}"></audio></li>`
      )).join('')}</ul>
    </div>`
    : ''

  const mediaRow = (frameCards || docCards || audioCard)
    ? `<div class="session-artifact-cards">${frameCards}${docCards}${audioCard}</div>`
    : ''

  return `<div class="session-frame-deck" data-frame-deck>${subagentHtml}${mediaRow}</div>`
}

function renderTimelineBar(line, t) {
  const steps = line.steps || []
  const total = steps.length
  const rawPins = []
  steps.forEach((s, idx) => {
    const pct = total > 0 ? ((idx + 0.5) / total) * 100 : 0
    if (s.compactInfo) {
      const droppedK = ((s.compactInfo.droppedTokens || 0) / 1000).toFixed(0)
      rawPins.push({
        idx,
        pct,
        pinType: 'compress',
        label: `${t('tlCompressPin', { seq: s.compactInfo.seq })}${droppedK > 0 ? ` (-${droppedK}k)` : ''}`,
        turn: s.turn,
      })
    } else if (s.frames?.length) {
      const aiFrame = s.frames.find(f => f.who === 'ai') || s.frames[0]
      rawPins.push({ idx, pct, pinType: 'frame', label: aiFrame.label, turn: s.turn })
    } else if (s.docs?.length) {
      rawPins.push({ idx, pct, pinType: 'doc', label: s.docs[0].title, turn: s.turn })
    } else if (s.kind === 'prompt') {
      rawPins.push({ idx, pct, pinType: 'turn', label: `#${s.turn}`, turn: s.turn })
    }
  })

  const occupiedPcts = []
  const canShowText = pct => pct >= 5 && pct <= 95 && occupiedPcts.every(p => Math.abs(p - pct) >= 11)
  for (const pin of rawPins) {
    if (pin.pinType === 'compress' && canShowText(pin.pct)) {
      pin.showText = true
      occupiedPcts.push(pin.pct)
    }
  }
  for (const pin of rawPins) {
    if (pin.pinType === 'frame' && canShowText(pin.pct)) {
      pin.showText = true
      occupiedPcts.push(pin.pct)
    }
  }
  for (const pin of rawPins) {
    if (pin.pinType === 'doc' && canShowText(pin.pct)) {
      pin.showText = true
      occupiedPcts.push(pin.pct)
    }
  }
  if (rawPins.length <= 14) {
    for (const pin of rawPins) {
      if (pin.pinType === 'turn' && canShowText(pin.pct)) {
        pin.showText = true
        occupiedPcts.push(pin.pct)
      }
    }
  }

  const pinsHtml = rawPins.map(pin => {
    const text = pin.pinType === 'compress'
      ? (pin.showText ? `🗜 ${escape(short(pin.label, 11))}` : '🗜')
      : pin.pinType === 'frame'
        ? (pin.showText ? `🖼 ${escape(short(pin.label, 8))}` : '🖼')
        : pin.pinType === 'doc'
          ? (pin.showText ? `📄 ${escape(short(pin.label, 8))}` : '📄')
          : (pin.showText ? `💬 #${pin.turn}` : '')
    const cls = `session-tl-pin is-${pin.pinType}${pin.showText ? ' has-label' : ' is-compact'}`
    return `<button type="button" class="${cls}" style="left:${pin.pct.toFixed(2)}%" data-tl-jump="${pin.idx}" data-tl-hover="${pin.idx}" aria-label="${escape(t('tlJumpAria', { step: pin.idx + 1, label: pin.label }))}">${text}</button>`
  }).join('')

  const segsHtml = steps.map((s, idx) => (
    `<div class="session-tl-seg${s.compactInfo ? ' has-compress' : s.frames?.length ? ' has-frame' : s.docs?.length ? ' has-doc' : ''}" data-tl-step="${idx}" data-tl-hover="${idx}"></div>`
  )).join('')
  const segGap = total > 360 ? '0px' : total > 160 ? '1px' : '2px'

  return `<footer class="session-timeline-bar" data-session-timeline aria-label="${escape(t('tlAria'))}">
    <div class="session-transport" role="group" aria-label="${escape(t('tlControlsAria'))}">
      <button type="button" class="session-nav-btn" data-session-prev disabled aria-label="${escape(t('prevStep'))}">◀</button>
      <button class="session-play" type="button" aria-label="${escape(t('playAria'))}">${escape(t('play'))}</button>
      <button type="button" class="session-nav-btn" data-session-next aria-label="${escape(t('nextStep'))}">▶</button>
      <span class="session-speed-badge" data-session-speed><b>0</b> / ${total} · 00:00</span>
    </div>
    <div class="session-tl-track-wrap" data-tl-track>
      <span class="session-composer-progress" data-session-progress aria-hidden="true"></span>
      <div class="session-tl-pop" data-tl-pop hidden></div>
      <div class="session-tl-pins" data-tl-pins>${pinsHtml}</div>
      <div class="session-tl-segs" style="--tl-gap:${segGap}" data-tl-segs>${segsHtml}</div>
    </div>
  </footer>`
}

function renderBrowserCategories(categories = [], t) {
  return categories.map(cat => {
    const list = cat.items || []
    const isEmpty = list.length === 0
    const deltaCls = String(cat.delta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
    const tokDeltaCls = String(cat.tokDelta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
    const itemsHtml = list.map(item => (
      `<div class="lc-br-elem session-browser-item${item.isNew ? ' is-new' : ''}" data-browser-item="${escape(item.id)}">
        <button type="button" class="lc-br-elem-row session-browser-item-btn" data-browser-item-toggle="${escape(item.id)}" aria-expanded="false">
          <span class="lc-br-chev"></span>
          ${item.tag ? `<span class="lc-br-tag">${escape(item.tag)}</span>` : ''}
          <span class="lc-br-preview session-browser-item-title">${escape(item.title)}</span>
          <span class="session-browser-item-meta"><span class="lc-br-time">${escape(item.meta || '')}</span></span>
        </button>
        <div class="lc-br-content session-browser-payload" hidden></div>
      </div>`
    )).join('')
    return `<div class="lc-br-cat session-browser-cat${isEmpty ? ' is-empty' : ''}" data-browser-cat="${escape(cat.id)}">
      <button type="button" class="lc-br-cat-row session-browser-cat-btn" data-browser-cat-toggle="${escape(cat.id)}" aria-expanded="false"${isEmpty ? ' disabled' : ''}>
        <span class="lc-br-chev"></span>
        <span class="lc-br-count-grp">
          <i class="session-cat-dot is-${escape(cat.color || cat.id)}"></i>
          <span class="lc-br-cat-label">${escape(cat.name)}</span>
          <span class="lc-br-cat-count">${escape(cat.count)}</span>
          ${cat.delta ? `<b class="lc-br-delta ${deltaCls} session-delta-badge">${escape(cat.delta)}</b>` : ''}
        </span>
        <span class="lc-br-tokens-grp">
          ${cat.tokDelta ? `<b class="lc-br-delta ${tokDeltaCls}">${escape(cat.tokDelta)}</b>` : ''}
          <span class="lc-br-tokens">${escape(cat.tok)}</span>
        </span>
      </button>
      <div class="lc-br-body session-browser-items" hidden>${itemsHtml || `<p class="session-ctx-empty">${escape(t('emptyCategory'))}</p>`}</div>
    </div>`
  }).join('')
}

function contextSidebar(line, t) {
  const initial = line.initialSnapshot
  const tok = n => `≈${(Number(n || 0) / 1000).toFixed(1)}k`
  return `<aside class="session-context-aside" aria-label="${escape(t('activeContext'))}" data-session-aside>
    <section class="sp-aside-sec" aria-label="${escape(t('activeContext'))}">
      <div class="sp-sec-head">
        <span class="sp-sec-title">${escape(t('activeContext'))}</span>
        <span class="sp-sec-snap" data-context-snap>${escape(t('snapInitial'))}</span>
      </div>
      <div class="lc-overview-num">
        <b data-context-tot>${escape((initial.totalTokens / 1000).toFixed(1))}k</b>
        <span>/ <span data-context-win>${escape(initial.windowLabel || '1.0M')}</span> tokens</span>
        <span class="lc-overview-pct"><b data-context-pct>${escape(String(initial.pct))}%</b>${escape(t('usedSuffix'))}</span>
      </div>
      <div class="lc-stacked" data-stacked-bar>
        <div class="lc-stacked-seg is-sys" data-seg="sys" data-cat-key="sys" style="width:${initial.segments.sys}%"></div>
        <div class="lc-stacked-seg is-schema" data-seg="schema" data-cat-key="schema" style="width:${initial.segments.schema}%"></div>
        <div class="lc-stacked-seg is-user" data-seg="user" data-cat-key="user" style="width:${initial.segments.user}%"></div>
        <div class="lc-stacked-seg is-mem" data-seg="mem" data-cat-key="mem" style="width:${initial.segments.mem}%"></div>
        <div class="lc-stacked-seg is-skill" data-seg="skill" data-cat-key="skill" style="width:${initial.segments.skill}%"></div>
        <div class="lc-stacked-seg is-msg" data-seg="msg" data-cat-key="msg" style="width:${initial.segments.msg}%"></div>
        <div class="lc-stacked-seg is-tool" data-seg="tool" data-cat-key="tool" style="width:${initial.segments.tool}%"></div>
        <div class="lc-stacked-free" title="${escape(t('freeSpaceTitle'))}"></div>
        <div class="lc-trigger" style="left:80%" title="${escape(t('autoCompactTriggerTitle'))}"></div>
        <div class="lc-reserve lc-reserve-headroom" style="left:80%;width:12%" title="${escape(t('headroomTitle'))}"></div>
        <div class="lc-reserve lc-reserve-output" style="left:92%;width:8%" title="${escape(t('outputReserveTitle'))}"></div>
      </div>
      <div class="lc-legend" data-lc-legend>
        <span class="lc-chip" data-cat-key="sys"><i class="session-cat-dot is-sys"></i><span class="lc-chip-label">${escape(t('legendSys'))}</span><span class="lc-chip-nums" data-pro-tok="sys">${escape(tok(initial.tokensByKind.sys))}</span></span>
        <span class="lc-chip" data-cat-key="schema"><i class="session-cat-dot is-schema"></i><span class="lc-chip-label">${escape(t('legendSchema'))}</span><span class="lc-chip-nums" data-pro-tok="schema">${escape(tok(initial.tokensByKind.schema))}</span></span>
        <span class="lc-chip" data-cat-key="user"><i class="session-cat-dot is-user"></i><span class="lc-chip-label">${escape(t('legendUser'))}</span><span class="lc-chip-nums" data-pro-tok="user">${escape(tok(initial.tokensByKind.user))}</span></span>
        <span class="lc-chip" data-cat-key="mem"><i class="session-cat-dot is-mem"></i><span class="lc-chip-label">${escape(t('legendMem'))}</span><span class="lc-chip-nums" data-pro-tok="mem">${escape(tok(initial.tokensByKind.mem))}</span></span>
        <span class="lc-chip" data-cat-key="skill"><i class="session-cat-dot is-skill"></i><span class="lc-chip-label">${escape(t('legendSkill'))}</span><span class="lc-chip-nums" data-pro-tok="skill">${escape(tok(initial.tokensByKind.skill))}</span></span>
        <span class="lc-chip" data-cat-key="msg"><i class="session-cat-dot is-msg"></i><span class="lc-chip-label">${escape(t('legendMsg'))}</span><span class="lc-chip-nums" data-pro-tok="msg">${escape(tok(initial.tokensByKind.msg))}</span></span>
        <span class="lc-chip" data-cat-key="tool"><i class="session-cat-dot is-tool"></i><span class="lc-chip-label">${escape(t('legendTool'))}</span><span class="lc-chip-nums" data-pro-tok="tool">${escape(tok(initial.tokensByKind.tool))}</span></span>
      </div>
    </section>
    <section class="sp-aside-sec sp-aside-browser" aria-label="${escape(t('contextInspector'))}">
      <div class="sp-sec-head">
        <span class="sp-sec-title">${escape(t('contextInspector'))}</span>
        <span class="sp-sec-hint">${escape(t('contextInspectorHint'))}</span>
      </div>
      <div class="lc-br-cats session-context-browser" data-context-browser>
        ${renderBrowserCategories(initial.categories, t)}
      </div>
    </section>
  </aside>`
}

function renderLog(session, line, { t, baseUrl = '' }) {
  const tool = toolLabels[session.tool] || session.tool || 'Agent'
  const render = text => renderMarkdown(localLinks(text))
  const entries = []
  let shown = -Infinity
  let stepIndex = 0

  const stamp = (seconds, forStep) => {
    if (seconds - shown < 300) return ''
    shown = seconds
    const baseMs = Date.parse(line.start)
    const iso = Number.isFinite(baseMs) ? new Date(baseMs + seconds * 1000).toISOString() : ''
    return `<li class="session-time" data-for-step="${forStep}" data-t="${seconds}"><time${iso ? ` datetime="${escape(iso)}"` : ''}>${escape(wallClock(line.start, seconds))}</time></li>`
  }

  let work = []
  const flush = () => {
    if (!work.length) return
    const stats = sumStats(work)
    const span = Math.max(...work.map(item => (item.agent ? item.t : item.d ?? item.t))) - work[0].t
    const count = work.filter(item => item.type === 'tool').length
    const thinkCount = work.filter(item => item.type === 'reasoning' && String(item.text || '').trim()).length
    const stepsHtml = work.map(item => {
      const time = `<time>${escape(wallClock(line.start, item.t, true))}</time>`
      if (item.type === 'reasoning') {
        const thinkLabel = t.lang === 'en' ? 'Thinking' : '思考'
        return `<li><details class="dsh-proc-row"><summary><span class="dsh-proc-dot is-think"></span><span class="dsh-proc-title">${thinkLabel}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-sum">${escape(short(item.text, 68))}</span>${time}</summary><div class="session-detail">${render(item.text)}</div></details></li>`
      }
      const body = [
        item.input && `<pre>${escape(item.input)}</pre>`,
        item.output && `<pre>${escape(item.output)}</pre>`,
        thumbs(item.images, baseUrl),
        clips(item.audio, baseUrl),
      ].filter(Boolean).join('')
      const toolTitle = escape(item.name || (t.lang === 'en' ? 'Tool' : '工具'))
      return body
        ? `<li><details class="dsh-proc-row"><summary><span class="dsh-proc-dot is-done"></span><span class="dsh-proc-title">${toolTitle}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-sum">${escape(item.summary)}</span>${time}</summary><div class="dsh-proc-io">${body}</div></details></li>`
        : `<li><div class="dsh-proc-row is-static"><span class="dsh-proc-dot is-done"></span><span class="dsh-proc-title">${toolTitle}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-sum">${escape(item.summary)}</span>${time}</div></li>`
    }).join('')

    if (!count && !thinkCount) {
      work = []
      return
    }
    const stepMeta = line.steps[stepIndex++]
    const summaryText = count
      ? (describeStats(stats, undefined, t.lang) || (t.lang === 'en' ? `Ran ${count} step(s)` : `执行了 ${count} 步操作`))
      : (t.lang === 'en' ? 'Thought before replying' : '进行了思考推理')
    const durationText = t.lang === 'en'
      ? (span >= 60 ? `${minutes(span)}m` : `${Math.max(1, Math.round(span))}s`)
      : (span >= 60 ? `${minutes(span)} 分钟` : `${Math.max(1, Math.round(span))} 秒`)
    const stepWord = count
      ? (t.lang === 'en' ? `${count} steps` : `${count} 步`)
      : (t.lang === 'en' ? `${thinkCount} thought(s)` : `${thinkCount} 段思考`)
    const echoCat = escape(stepMeta?.primaryCat || 'tool')
    entries.push(`${stamp(work[0].t, stepIndex - 1)}<li class="session-entry session-work" data-step="${stepIndex - 1}" data-echo-cat="${echoCat}" data-kind="${escape(stepMeta?.kind || 'fast-tools')}" data-t="${work[0].t}"><div class="session-montage-row" data-montage-row hidden></div><details class="session-chip dsh-process-group" data-process-details><summary><span class="dsh-proc-lead"></span><span class="dsh-proc-group-label">${escape(summaryText)}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-dur">${escape(durationText)} · ${escape(stepWord)}</span></summary><div class="session-chip-body"><ol class="session-steps">${stepsHtml}</ol></div></details>${renderStepArtifacts(stepMeta, { renderMd: render, t, baseUrl })}</li>`)
    work = []
  }

  for (const item of line.items) {
    if (item.type === 'tool' || item.type === 'reasoning') {
      work.push(item)
      continue
    }
    flush()
    const stepMeta = line.steps[stepIndex++]
    if (item.type === 'user') {
      const kept = item.images?.length || 0
      const missing = ((item.text || '').match(imageMark) || []).length - kept
      const omittedSuffix = missing > 0
        ? `\n\n${t('omittedImages', { prefix: kept ? t('omittedImagesAlso') : '', count: missing })}`
        : ''
      const text = `${unmarked(item.text)}${omittedSuffix}`
      const hasCuratedFrames = Array.isArray(session.frames) && session.frames.length > 0
      const frameImgs = new Set((stepMeta?.frames || []).map(fr => fr.img))
      const inlineImages = hasCuratedFrames ? [] : (item.images || []).filter(img => !frameImgs.has(img))
      entries.push(`${stamp(item.t, stepIndex - 1)}<li class="session-entry session-you" data-step="${stepIndex - 1}" data-echo-cat="user" data-kind="prompt" data-t="${item.t}"><div class="session-bubble">${render(text)}${thumbs(inlineImages, baseUrl)}</div>${renderStepArtifacts(stepMeta, { renderMd: render, t, baseUrl })}</li>`)
    } else if (item.type === 'compact') {
      const ci = stepMeta?.compactInfo || {}
      const preK = ci.preTokens ? `${(ci.preTokens / 1000).toFixed(1)}k` : ''
      const postK = ci.postTokens ? `${(ci.postTokens / 1000).toFixed(1)}k` : ''
      const dropK = ci.droppedTokens ? `${(ci.droppedTokens / 1000).toFixed(1)}k` : ''
      const tpl = ci.docId && ci.content ? `<template data-doc-html="${escape(ci.docId)}">${render(ci.content)}</template>` : ''
      const badgeText = ci.trigger === 'manual' ? t('compactManual') : ci.trigger === 'handoff' ? t('compactHandoff') : t('compactAuto')
      const freedText = dropK ? t('compactFreed', { tokens: dropK }) : ''
      entries.push(`${stamp(item.t, stepIndex - 1)}<li class="session-entry session-compact" data-step="${stepIndex - 1}" data-echo-cat="tool" data-kind="compact" data-t="${item.t}"><div class="session-compact-card"><span class="session-compact-icon" aria-hidden="true">🗜</span><div class="session-compact-main"><div class="session-compact-head"><b>${escape(t('compactTitle', { seq: ci.seq || 1 }))}</b><span class="session-compact-tag">${escape(badgeText)}</span>${preK && postK ? `<span class="session-compact-meter">${escape(preK)} → ${escape(postK)}${escape(freedText)}</span>` : ''}</div><p class="session-compact-desc">${escape(t('compactDesc', { count: ci.archivedTools || 0 }))}</p></div>${ci.docId ? `<button type="button" class="session-compact-btn" data-doc-open="${escape(ci.docId)}" data-doc-title="${escape(ci.title || t('compactModalTitle'))}">${escape(t('compactViewBtn'))}</button>${tpl}` : ''}</div></li>`)
    } else {
      entries.push(`${stamp(item.t, stepIndex - 1)}<li class="session-entry session-ai" data-step="${stepIndex - 1}" data-echo-cat="msg" data-kind="reply" data-t="${item.t}"><div class="session-bubble">${item.question ? `<span class="session-who">${escape(t('asksYou', { tool }))}</span>` : ''}<div class="session-ai-body">${render(item.text)}</div>${renderStepArtifacts(stepMeta, { renderMd: render, t, baseUrl })}</div></li>`)
    }
  }
  flush()

  const deliverables = session.deliverables || session.files || []
  const filesHtml = deliverables.map(file => {
    const href = escape(resolveAsset(file.href, baseUrl))
    const cover = file.cover ? escape(resolveAsset(file.cover, baseUrl)) : ''
    return validVideo.test(file.href)
      ? `<figure class="session-video"><video controls preload="none" playsinline width="960" height="540"${cover ? ` poster="${cover}"` : ''}><source src="${href}" type="video/mp4"></video><figcaption><b>${escape(file.title)}</b>${file.meta ? `<small>${escape(file.meta)}</small>` : ''}</figcaption></figure>`
      : `<a class="session-file" href="${href}" target="_blank" rel="noopener noreferrer">${cover ? `<img src="${cover}" alt="" width="56" height="79" loading="lazy">` : ''}<span><b>${escape(file.title)}</b>${file.meta ? `<small>${escape(file.meta)}</small>` : ''}</span></a>`
  }).join('')
  if (filesHtml) {
    entries.push(`<li class="session-entry session-ai session-files" data-for-step="${Math.max(0, line.steps.length - 1)}" data-t="${line.end}"><div class="session-bubble"><span class="session-who">${escape(t('deliverablesTitle'))}</span>${filesHtml}</div></li>`)
  }
  return `<ol class="session-log">${entries.join('')}</ol>`
}

export function buildPlayerData(session, line, { baseUrl = '' } = {}) {
  const tool = toolLabels[session.tool] || session.tool || 'Agent'
  const items = line.items.filter(item => item.type !== 'reasoning').map(item => {
    const labelText = item.type === 'tool' || item.type === 'compact' ? (item.summary || item.text || '') : plain(unmarked(item.text))
    const compact = { t: item.t, type: item.type, s: short(labelText, item.type === 'user' ? 400 : 120) }
    if (item.question) compact.q = 1
    return compact
  })
  const stripCatItems = snapshot => {
    if (!snapshot?.categories) return snapshot
    return {
      ...snapshot,
      categories: snapshot.categories.map(({ items: _items, ...rest }) => rest),
    }
  }
  const baseSnap = stripCatItems(line.initialSnapshot)
  const baseIdsByCat = Object.fromEntries((baseSnap?.categories || []).map(c => [c.id, (c.itemIds || []).join('\n')]))
  const slimStepSnapshot = snapshot => {
    if (!snapshot?.categories) return snapshot
    return {
      ...snapshot,
      categories: snapshot.categories.map(({ items: _items, name: _n, color: _c, itemIds, newIds, ...rest }) => {
        const sameIds = (itemIds || []).join('\n') === baseIdsByCat[rest.id]
        return {
          ...rest,
          ...(sameIds ? {} : { itemIds }),
          ...(newIds?.length ? { newIds } : {}),
        }
      }),
    }
  }
  const compactSteps = line.steps.map(step => ({
    ...step,
    ...(step.frames ? { frames: step.frames.map(fr => ({ ...fr, img: resolveAsset(fr.img, baseUrl) })) } : {}),
    contextSnapshot: slimStepSnapshot(step.contextSnapshot),
    ...(step.compactInfo ? { compactInfo: (({ content: _cc, ...rest }) => rest)(step.compactInfo) } : {}),
    ...(step.docs ? { docs: step.docs.map(({ content: _c, ...rest }) => rest) } : {}),
    ...(step.subagents ? { subagents: step.subagents.map(({ report: _r, ...rest }) => rest) } : {}),
  }))

  const contextRecords = Object.fromEntries(
    Object.entries(line.contextRecords || {}).map(([id, rec]) => [
      id,
      rec.images?.length
        ? { ...rec, images: rec.images.map(img => resolveAsset(img, baseUrl)) }
        : rec,
    ])
  )

  return {
    start: line.start,
    end: line.end,
    tool,
    items,
    initialSnapshot: baseSnap,
    contextRecords,
    steps: compactSteps,
    lanes: line.lanes.map(lane => ({ a: lane.agent, s: lane.s, e: lane.e })),
    waits: line.waits,
    frames: line.frames.map(frame => ({
      t: frame.t,
      src: resolveAsset(frame.img, baseUrl),
      label: frame.label,
      who: frame.who,
      w: frame.w,
      h: frame.h,
    })),
    wide: isWide(line.frames),
  }
}

export function renderPlayerWidget(session, computedTimeline, {
  lang = 'zh',
  baseUrl = '',
  backHref = '',
  backLabel = '',
  showLangToggle = !backHref,
} = {}) {
  const t = createTranslator(lang || session.lang || 'zh')
  const line = computedTimeline || timeline(session, { lang: t.lang })
  const tool = toolLabels[session.tool] || session.tool || 'Agent'
  const title = session.title || session.task || `${tool} Session`
  const description = session.description || ''
  const firstItem = (session.items || [])[0]
  const rawFirstPrompt = firstItem?.type === 'user' ? unmarked(firstItem.text).trim() : ''
  const firstPromptDraft = rawFirstPrompt && rawFirstPrompt !== '（中途打断）' ? rawFirstPrompt : ''
  const hasInitialDraft = Boolean(firstPromptDraft)
  const dataJson = JSON.stringify(buildPlayerData(session, line, { baseUrl })).replace(/</g, '\\u003c')
  const leadBadge = backHref && backLabel
    ? `<a class="session-back" href="${escape(backHref)}">${escape(backLabel)}</a>`
    : `<span class="encore-brand-badge" aria-hidden="true">ENCORE</span>`
  const rightControls = showLangToggle
    ? `<div class="session-topbar-right">
        <button type="button" class="encore-lang-btn" data-encore-lang-toggle title="${escape(t('toggleLangTitle'))}">${escape(t('toggleLangLabel'))}</button>
      </div>`
    : ''

  return `<div class="session-app" data-encore-lang="${escape(t.lang)}">
    <header class="session-topbar">
      <div class="session-topbar-left">
        ${leadBadge}
        <span class="session-topbar-sep" aria-hidden="true">/</span>
        <h1 class="session-title">${escape(title)}</h1>
        <span class="session-model-pill">${escape(tool)}${session.model ? ` · ${escape(session.model)}` : ''}</span>
      </div>
      ${rightControls}
    </header>
    <section class="session-player" aria-label="${escape(t('tlAria'))}" hidden>
      ${scrubber(line)}
    </section>
    <div class="session-stage-grid" data-session-grid>
      <div class="session-chat-pane" data-session-chat>
        <div class="session-chat-scroll" data-session-scroll>
          <div class="dsh-chat-column">
            <div class="session-empty-stage" data-session-empty hidden>
              ${description ? `<p class="session-empty-desc">${escape(description)}</p>` : ''}
              <p class="session-empty-hint">${t('emptyHintStart')}${hasInitialDraft ? t('emptyHintOrSend') : ''}${t('emptyHintEnd')}</p>
            </div>
            ${renderLog(session, line, { t, baseUrl })}
          </div>
        </div>
        <div class="session-dock-wrap">
          <div class="session-composer" data-session-composer>
            <div class="session-composer-editor" data-session-stage-trigger>
              <div class="session-composer-text${hasInitialDraft ? '' : ' is-placeholder'}" data-session-composer-text>${escape(firstPromptDraft || t('composerPlaceholder'))}</div>
            </div>
            <div class="session-composer-bar">
              <span class="session-composer-left">
                <span class="session-composer-plus" aria-hidden="true">+</span>
                <span class="session-composer-perm" data-session-stage-badge>Workspace Write</span>
              </span>
              <span class="session-composer-right">
                <span class="session-composer-model">${escape(session.model || tool)}</span>
                <button type="button" class="session-composer-send${hasInitialDraft ? ' is-ready' : ''}" data-session-send aria-label="${escape(t('sendOrPause'))}"${hasInitialDraft ? '' : ' disabled'}>↑</button>
              </span>
            </div>
          </div>
        </div>
      </div>
      ${contextSidebar(line, t)}
    </div>
    ${renderTimelineBar(line, t)}
    <dialog class="session-lightbox" data-session-lightbox aria-label="${escape(t('lightboxDefaultTitle'))}">
      <div class="session-lightbox-inner">
        <div class="session-lightbox-head">
          <b data-lightbox-title>${escape(t('lightboxDefaultTitle'))}</b>
          <button type="button" class="session-lightbox-close" data-lightbox-close aria-label="${escape(t('closePreview'))}">✕</button>
        </div>
        <div class="session-lightbox-body">
          <img data-lightbox-img alt="">
          <article class="session-lightbox-doc" data-lightbox-doc hidden></article>
        </div>
      </div>
    </dialog>
    <script type="application/json" data-encore-session-data>${dataJson}</script>
  </div>`
}

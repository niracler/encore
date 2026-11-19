import { escapeHtml } from './markdown.mjs'

function attachmentTable(rows, { compact = false } = {}) {
  if (!rows.length) return ''
  const head = rows[0].map(cell => `<th scope="col">${escapeHtml(cell)}</th>`).join('')
  const body = rows.slice(1).map(row => {
    const cells = row.map(value => {
      const text = String(value ?? '')
      const content = !compact && text.length > 70
        ? `<details><summary>${escapeHtml(text.slice(0, 52))}…</summary>${escapeHtml(text)}</details>`
        : escapeHtml(text)
      return `<td>${content}</td>`
    })
    return `<tr>${cells.join('')}</tr>`
  })
  return `<table><thead><tr>${head}</tr></thead><tbody>${body.join('')}</tbody></table>`
}

function renderRevision(file, t, url) {
  const change = file.preview.change
  if (!change || !file.revision) return ''
  const revision = file.revision
  const pdf = file.preview.type === 'pdf'
  const location = pdf ? t('pdfPage', { n: revision.page }) : `${revision.sheet} · ${revision.cell}`
  const before = Array.from(change.before), after = Array.from(change.after)
  const shorter = Math.min(before.length, after.length)
  let start = 0, end = 0
  while (start < shorter && before[start] === after[start]) start++
  while (end < shorter - start && before.at(-1 - end) === after.at(-1 - end)) end++
  function side(chars, original) {
    const stop = chars.length - end
    const tag = original ? 'del' : 'ins'
    const text = escapeHtml(chars.slice(0, start).join(''))
      + `<${tag}>${escapeHtml(chars.slice(start, stop).join(''))}</${tag}>`
      + escapeHtml(chars.slice(stop).join(''))
    const src = url(original ? revision.href : file.href)
    const link = pdf
      ? `<a href="${escapeHtml(src)}#page=${Number(revision.page)}" target="_blank" rel="noopener noreferrer">${t('openSourcePage')}</a>`
      : `<a href="${escapeHtml(src)}" download>${t('downloadFile', { type: 'Excel' })}</a>`
    return `<section><strong>${t(original ? 'beforeRevision' : 'afterRevision')}</strong><p>${text}</p>${link}</section>`
  }
  return `<details class="session-revision"><summary>${t('viewChanges')}</summary>
    <div class="session-revision-context"><b>${escapeHtml(revision.label)}</b><span>${escapeHtml(location)}</span></div>
    <div class="session-revision-pair">${side(before, true)}${side(after, false)}</div></details>`
}

export function renderAttachment(file, t, url) {
  const preview = file.preview
  const pdf = preview.type === 'pdf'
  const type = pdf ? 'PDF' : 'Excel'
  const action = t(pdf ? 'readPdf' : 'readWorkbook')
  const count = pdf ? t('pdfPages', { n: preview.pages.length }) : t('sheetCount', { n: preview.count })
  const download = `<a href="${escapeHtml(url(file.href))}" download${file.availability ? `="${escapeHtml(file.title)}"` : ''}>${t('downloadFile', { type })}</a>`
  const title = escapeHtml(file.title)
  const toolbar = pdf
    ? `<button type="button" data-page-prev aria-label="${t('prevPage')}">‹</button>
       <label>${t('pageNumber')} <input data-page-number type="number" min="1" max="${preview.pages.length}" value="1"> / ${preview.pages.length}</label>
       <button type="button" data-page-next aria-label="${t('nextPage')}">›</button>
       <select data-page-zoom aria-label="${t('zoom')}"><option value="100">${t('fitWidth')}</option><option value="125">125%</option><option value="150">150%</option></select>`
    : `<label>${t('sheetName')} <select data-sheet-picker></select></label>`
  const content = pdf
    ? `<template>${preview.pages.map((page, i) => `<img loading="lazy" src="${escapeHtml(url(page.src))}" width="${Number(page.width)}" height="${Number(page.height)}" alt="${escapeHtml(t('pdfPage', { n: i + 1 }))}">`).join('')}</template>`
    : ''
  const source = pdf ? '' : ` data-workbook-src="${escapeHtml(url(preview.src))}" data-first-sheet="${escapeHtml(preview.sheet)}"`
  const summary = pdf
    ? `<img class="session-pdf-cover" src="${escapeHtml(url(file.cover || preview.pages[0].src))}" alt="" loading="lazy">`
    : ''
  return `<section class="session-attachment" data-attachment="${preview.type}"${source}>
    <div class="session-attachment-head">${summary}<div><strong>${title}</strong>
    <small>${type} · ${count}${file.meta ? ' · ' + escapeHtml(file.meta) : ''}</small></div></div>
    ${pdf ? '' : `<div class="session-sheet-sample">${attachmentTable(preview.rows, { compact: true })}</div>`}
    <div class="session-attachment-actions"><button type="button" data-open-attachment>${action}</button>${download}</div>
    ${renderRevision(file, t, url)}
    <dialog class="session-attachment-dialog" aria-label="${title}">
      <header><strong>${title}</strong>${download}<button type="button" data-close-attachment aria-label="${t('closePreview')}">✕</button></header>
      <div class="session-attachment-toolbar">${toolbar}</div>
      <div class="session-attachment-viewport" role="region" aria-label="${title}" tabindex="0"></div>
    </dialog>${content}
  </section>`
}

function attachPdfReader(card, viewport) {
  viewport.append(card.querySelector('template').content.cloneNode(true))
  const pages = [...viewport.querySelectorAll('img')]
  const number = card.querySelector('[data-page-number]')
  const previous = card.querySelector('[data-page-prev]')
  const next = card.querySelector('[data-page-next]')
  function setPage(n) {
    number.value = n
    previous.disabled = n === 1
    next.disabled = n === pages.length
  }
  function jump(n) {
    n = Math.max(1, Math.min(pages.length, Math.round(n) || 1))
    pages[n - 1].scrollIntoView({ block: 'start', inline: 'nearest' })
    setPage(n)
  }
  number.addEventListener('change', () => jump(number.valueAsNumber))
  number.addEventListener('keydown', event => {
    if (event.key === 'Enter') jump(number.valueAsNumber)
  })
  previous.addEventListener('click', () => jump(number.valueAsNumber - 1))
  next.addEventListener('click', () => jump(number.valueAsNumber + 1))
  card.querySelector('[data-page-zoom]').addEventListener('change', event => {
    viewport.style.setProperty('--attachment-page-width', event.target.value + '%')
    jump(number.valueAsNumber)
  })
  viewport.addEventListener('scroll', () => {
    if (document.activeElement === number) return
    const top = viewport.getBoundingClientRect().top + 32
    const i = pages.findIndex(page => page.getBoundingClientRect().bottom > top)
    setPage(i < 0 ? pages.length : i + 1)
  }, { passive: true })
  setPage(1)
}

async function attachWorkbookReader(card, viewport, t) {
  const response = await fetch(card.dataset.workbookSrc)
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const sheets = await response.json()
  const picker = card.querySelector('[data-sheet-picker]')
  for (const sheet of sheets) picker.add(new Option(sheet.sheet, sheet.sheet))
  picker.value = card.dataset.firstSheet
  function selectSheet() {
    viewport.innerHTML = attachmentTable(sheets[picker.selectedIndex].data) || escapeHtml(t('emptySheet'))
    viewport.scrollTo(0, 0)
  }
  picker.addEventListener('change', selectSheet)
  selectSheet()
}

export function attachAttachmentReaders(container, t, pauseReplay) {
  for (const card of container.querySelectorAll('[data-attachment]')) {
    const revision = card.querySelector('.session-revision')
    revision?.addEventListener('toggle', () => {
      if (revision.open) {
        pauseReplay()
        revision.scrollIntoView({ block: 'nearest' })
      }
    })
    const dialog = card.querySelector('dialog')
    const viewport = card.querySelector('.session-attachment-viewport')
    let initialized = false
    card.querySelector('[data-open-attachment]').addEventListener('click', async () => {
      pauseReplay()
      dialog.showModal()
      if (initialized) return
      initialized = true
      if (card.dataset.attachment === 'pdf') {
        attachPdfReader(card, viewport)
      } else {
        viewport.textContent = t('loadingSheet')
        try {
          await attachWorkbookReader(card, viewport, t)
        } catch {
          viewport.textContent = t('sheetLoadError')
          initialized = false
        }
      }
    })
    card.querySelector('[data-close-attachment]').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const box = dialog.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close()
      }
    })
  }
}

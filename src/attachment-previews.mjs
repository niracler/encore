import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import sharp from 'sharp'

async function readWorkbook(bytes) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  // The preview reads worksheet cells. Excel table definitions can use producer-specific relationship paths.
  await workbook.xlsx.load(bytes, { ignoreNodes: ['tableParts'] })
  return workbook
}

function cellText(cell) {
  return cell.value instanceof Date ? cell.value.toISOString() : cell.text
}

function readReplayAsset(directory, href) {
  if (!href || /^(?:[a-z][\w+.-]*:|[/\\])/i.test(href)) throw new Error('Expected a replay-relative file')
  const path = realpathSync(resolve(directory, href))
  if (!path.startsWith(realpathSync(directory) + sep)) throw new Error('File is outside the replay')
  return readFileSync(path)
}

async function revisionValue(bytes, ext, revision) {
  if (ext === '.xlsx') {
    const address = /^([A-Z]+)([1-9]\d*)$/i.exec(revision.cell)
    if (!address || !revision.sheet) throw new Error('Expected a sheet name and A1 cell address')
    const workbook = await readWorkbook(bytes)
    const sheet = workbook.getWorksheet(revision.sheet)
    if (!sheet) throw new Error(`Worksheet not found: ${revision.sheet}`)
    return cellText(sheet.getCell(revision.cell.toUpperCase()))
  }
  const { PDFiumLibrary } = await import('@hyzyla/pdfium')
  const library = await PDFiumLibrary.init()
  let document
  try {
    document = await library.loadDocument(bytes)
    if (!Number.isInteger(revision.page) || revision.page < 1 || revision.page > document.getPageCount()) {
      throw new Error('PDF page is out of range')
    }
    const lines = document.getPage(revision.page - 1).getText().split(/\r\n|[\r\n]/).map(line => line.trim())
    const matches = lines.filter(line => revision.linePrefix && line.startsWith(revision.linePrefix))
    if (matches.length !== 1) throw new Error(`Expected one matching PDF line on page ${revision.page}, found ${matches.length}`)
    return matches[0]
  } finally {
    document?.destroy()
    library.destroy()
  }
}

async function previewPdf(bytes, staging, url) {
  const { PDFiumLibrary } = await import('@hyzyla/pdfium')
  const library = await PDFiumLibrary.init()
  let document
  try {
    document = await library.loadDocument(bytes)
    const pages = []
    for (const page of document.pages()) {
      const { originalWidth, originalHeight } = page.getOriginalSize()
      const image = await page.render({ scale: 1800 / Math.max(originalWidth, originalHeight), render: 'bitmap' })
      const name = `page-${pages.length + 1}.webp`
      await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
        .webp({ quality: 85 }).toFile(join(staging, name))
      pages.push({ src: url + name, width: image.width, height: image.height })
    }
    if (!pages.length) throw new Error('Empty PDF')
    return { type: 'pdf', pages }
  } finally {
    document?.destroy()
    library.destroy()
  }
}

async function previewWorkbook(bytes, staging, url, file) {
  const workbook = await readWorkbook(bytes)
  const sheets = workbook.worksheets.map(sheet => {
    const data = []
    sheet.eachRow({ includeEmpty: true }, row => {
      const values = []
      row.eachCell({ includeEmpty: true }, cell => values.push(cellText(cell)))
      data.push(values)
    })
    return { sheet: sheet.name, data }
  })
  const selected = sheets.find(sheet => sheet.sheet === file.previewSheet) || sheets[0]
  if (!selected) throw new Error('Empty workbook')
  const header = selected.data[0] || []
  const indexes = file.previewColumns?.length
    ? file.previewColumns.map(name => header.indexOf(name)).filter(index => index >= 0)
    : []
  if (!indexes.length) indexes.push(...header.slice(0, 3).map((_, i) => i))
  const rows = selected.data.slice(0, 4).map(row => indexes.map(i => String(row[i] ?? '')))
  writeFileSync(join(staging, 'sheets.json'), JSON.stringify(sheets))
  return { type: 'xlsx', src: url + 'sheets.json', sheet: selected.sheet, count: sheets.length, rows }
}

// Preview only files packaged inside this replay. External links keep their existing behavior.
export async function prepareAttachmentPreviews(session, directory) {
  let changed = false
  const files = [...(session.deliverables || session.files || []), ...(session.items || []).flatMap(item => item.deliverables || [])]
  for (const file of files) {
    if (file.availability === 'missing') continue
    const href = file.href || ''
    const ext = extname(href).toLowerCase()
    if (!['.pdf', '.xlsx'].includes(ext) || /^(?:[a-z][\w+.-]*:|[/\\])/i.test(href)) continue
    let preview
    try {
      const bytes = readReplayAsset(directory, href)
      const key = createHash('sha256').update(bytes)
        .update(JSON.stringify([1, ext, file.previewSheet, file.previewColumns])).digest('hex').slice(0, 24)
      const url = `encore-previews/${key}/`
      const target = join(directory, url)
      const manifest = join(target, 'preview.json')
      if (!existsSync(manifest)) {
        const root = join(directory, 'encore-previews')
        mkdirSync(root, { recursive: true })
        const staging = mkdtempSync(join(root, 'building-'))
        try {
          preview = ext === '.pdf' ? await previewPdf(bytes, staging, url) : await previewWorkbook(bytes, staging, url, file)
          writeFileSync(join(staging, 'preview.json'), JSON.stringify(preview))
          try {
            renameSync(staging, target)
          } catch (err) {
            if (!existsSync(manifest)) throw err
          }
        } finally {
          rmSync(staging, { recursive: true, force: true })
        }
      }
      preview = JSON.parse(readFileSync(manifest, 'utf8'))
      if (file.revision) {
        try {
          const previous = readReplayAsset(directory, file.revision.href)
          const before = await revisionValue(previous, ext, file.revision)
          const after = await revisionValue(bytes, ext, file.revision)
          if (before !== after) preview.change = { before, after }
        } catch (err) {
          // A missing earlier version does not prevent reading the current file.
          console.warn(`Could not compare ${href}: ${err.message}`)
        }
      }
    } catch (err) {
      // An unreadable attachment can still be downloaded. Keep the rest of the replay usable.
      console.warn(`Could not preview ${href}: ${err.message}`)
      preview = undefined
    }
    if (JSON.stringify(file.preview) !== JSON.stringify(preview)) {
      if (preview) file.preview = preview
      else delete file.preview
      changed = true
    }
  }
  return changed
}

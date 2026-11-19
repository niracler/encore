import { attachmentLabel, createTranscript, describeTool, isoTime, textOf } from './common.mjs'

function mainLine(messages) {
  if (!Array.isArray(messages) || !messages.length) return []
  const byId = new Map(messages.filter(message => message.uuid).map(message => [message.uuid, message]))
  if (!messages.some(message => message.parent_message_uuid && byId.has(message.parent_message_uuid))) return messages
  const line = []
  let message = messages.reduce((latest, item) => (item.created_at >= latest.created_at ? item : latest))
  for (const seen = new Set(); message && !seen.has(message.uuid); message = byId.get(message.parent_message_uuid)) {
    seen.add(message.uuid)
    line.unshift(message)
  }
  return line
}

const answers = text => [...String(text).matchAll(/"[^"\n]*"="([^"\n]*)"/g)].map(match => match[1])

export function readClaudeAi(data, { conversation } = {}) {
  const list = Array.isArray(data) ? data : data.chat_messages ? [data] : []
  const chat = conversation ? list.find(item => item.uuid === conversation) : list[0]
  if (!chat) {
    throw new Error(conversation ? `Conversation not found in export: ${conversation}` : 'No conversation found in export file')
  }
  const transcript = createTranscript()
  const questions = new Set()
  let last

  const result = (block, time) => {
    if (!questions.has(block.tool_use_id)) return transcript.result(block.tool_use_id, textOf(block.content), time)
    const chosen = answers(textOf(block.content))
    if (chosen.length) transcript.user(chosen.join('\n'), time, { answer: true })
  }

  for (const message of mainLine(chat.chat_messages || [])) {
    const blocks = message.content?.length ? message.content : [{ type: 'text', text: message.text }]
    if (message.sender === 'human') {
      const time = isoTime(message.created_at)
      last = time
      for (const block of blocks.filter(item => item.type === 'tool_result')) result(block, time)
      const names = [...(message.attachments || []), ...(message.files || [])].map(
        file => file.file_name || file.extracted_content?.match(/^#*\s*(\S.*)$/m)?.[1].trim()
      )
      const files = names.filter(Boolean).map(attachmentLabel)
      const deliverables = names.filter(Boolean).map(title => ({ title, availability: 'missing' }))
      transcript.user([textOf(blocks.filter(block => block.type === 'text')).trim(), ...files].filter(Boolean).join('\n\n'), time,
        deliverables.length ? { deliverables } : {})
      continue
    }
    const stamps = blocks.map(block => isoTime(block.start_timestamp))
    const after = index => stamps.slice(index + 1).find(Boolean) || isoTime(message.created_at)
    blocks.forEach((block, index) => {
      const time = stamps[index] || last || isoTime(message.created_at)
      if (block.type === 'text') transcript.assistant(block.text, time)
      else if (block.type === 'thinking') {
        transcript.reasoning(block.thinking || (block.summaries || []).map(item => item.summary).join('\n'), time)
      } else if (block.type === 'tool_use' && block.name === 'SendUserMessage') {
        transcript.assistant(block.input?.message, time)
      } else if (block.type === 'tool_use' && block.name === 'AskUserQuestion') {
        questions.add(block.id)
        const asked = (block.input?.questions || []).map(item => [item.question, ...(item.options || []).map(option => `- ${option.label}`)].join('\n'))
        transcript.assistant(asked.join('\n\n'), time, { question: true })
      } else if (block.type === 'tool_use') {
        transcript.tool(block.id, describeTool(block.name, block.input), time)
      } else if (block.type === 'tool_result') {
        result(block, after(index))
      }
      if (block.start_timestamp) last = isoTime(block.stop_timestamp || block.start_timestamp)
    })
  }
  return transcript.finish({ tool: 'claude-ai', title: chat.name })
}

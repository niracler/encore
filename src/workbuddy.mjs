import {
  createTranscript,
  describeTool,
  imagesOf,
  isoTime,
  mentions,
  parseArguments,
  stripInjected,
  textOf,
} from './common.mjs'

// WorkBuddy sessions: ~/.workbuddy/projects/<workspace>/<id>.jsonl, records in OpenAI Responses shape.
export function workBuddyUserText(content, references) {
  const text = textOf(content)
  const queries = [...text.matchAll(/<user_query>([\s\S]*?)<\/user_query>/g)].map(match => match[1].trim())
  return mentions(queries.length ? queries.join('\n\n') : stripInjected(text), references)
}

export function readWorkBuddy(records) {
  const transcript = createTranscript()
  const usage = new Map()
  let model
  let title
  for (const record of records) {
    const time = isoTime(record.timestamp)
    const provider = record.providerData || {}
    model = model || provider.model
    if (provider.rawUsage && provider.messageId) {
      usage.set(provider.messageId, provider.rawUsage.total_tokens || 0)
    }
    if (record.type === 'ai-title') {
      title = record.aiTitle
    } else if (record.type === 'message' && record.role === 'user') {
      const references = []
      transcript.user(workBuddyUserText(record.content, references), time, { images: imagesOf(record.content), references, cwd: record.cwd })
    } else if (record.type === 'message' && record.role === 'assistant') {
      transcript.assistant(textOf(record.content), time, { cwd: record.cwd })
    } else if (record.type === 'reasoning') {
      transcript.reasoning(textOf(record.rawContent?.length ? record.rawContent : record.content), time)
    } else if (record.type === 'function_call') {
      transcript.tool(record.callId, describeTool(record.name, parseArguments(record.arguments)), time)
    } else if (record.type === 'function_call_result') {
      transcript.result(record.callId, stripInjected(textOf(record.output)), time, imagesOf(record.output), record.cwd)
    }
  }
  const tokens = [...usage.values()].reduce((sum, value) => sum + value, 0) || undefined
  return transcript.finish({ tool: 'workbuddy', model, title, tokens })
}

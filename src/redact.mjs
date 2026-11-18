import { homedir } from 'node:os'

const rules = [
  { name: '私钥 / Private Key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g, mask: '[密钥]' },
  { name: '内嵌图片 / Data URI', pattern: /data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, mask: '[图片]' },
  { name: 'JWT 令牌 / JWT Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, mask: '[密钥]' },
  { name: '连接串凭据 / Connection URI', pattern: /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|amqps):\/\/[^/\s:@]+:)[^/\s@]+(@[^\s"'`]+)/gi, mask: '$1[密钥]$2' },
  { name: '密钥赋值 / Secret Env Assignment', pattern: /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*=\s*(['"]?)[^\s'"`;]{8,}\2/g, mask: '$1=[密钥]' },
  { name: '编码数据 / Base64 Blob', pattern: /[A-Za-z0-9+/_-]{200,}={0,2}/g, mask: '[编码数据]' },
  { name: '密钥 / API Key', pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|npm_[A-Za-z0-9]{30,}|pypi-[A-Za-z0-9_-]{32,})\b/g, mask: '[密钥]' },
  { name: '访问令牌 / Bearer Token', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/g, mask: 'Bearer [密钥]' },
  { name: '邮箱 / Email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, mask: '[邮箱]' },
  { name: '本机路径 / Home Path', pattern: /(?:(?:\/Users|\/home)\/[^/\s"'`)\]]+|[A-Za-z]:\\Users\\[^\\\s"'`)\]]+)/g, mask: '~' },
  { name: '内网地址 / Private IP', pattern: /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, mask: '[内网地址]' },
]

// Advisory patterns checked after automatic redaction to warn the user without blocking HTML generation.
const advisoryRules = [
  { name: '疑似凭据参数 / URL Secret Param', pattern: /[?&](?:token|api_key|apikey|secret|password|passwd|access_token)=[^&\s"'`]+/gi },
  { name: '疑似内网域名 / Internal Domain', pattern: /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.(?:internal|local|lan|corp|intranet)\b/gi },
]

export function redactText(text) {
  let result = String(text).replaceAll(homedir(), '~')
  for (const rule of rules) result = result.replace(rule.pattern, rule.mask)
  return result
}

function mapStrings(value, callback, path = '') {
  if (typeof value === 'string') return callback(value, path)
  if (Array.isArray(value)) return value.map((item, index) => mapStrings(item, callback, `${path}[${index}]`))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, callback, path ? `${path}.${key}` : key)])
    )
  }
  return value
}

export function redactSession(session) {
  return mapStrings(session, redactText)
}

function clip(text, limit) {
  if (typeof text !== 'string' || text.length <= limit) return [text, 0]
  const head = Math.round(limit * 0.75)
  const tail = Math.round(limit * 0.2)
  const omitted = text.length - head - tail
  return [`${text.slice(0, head)}\n\n…（中间省略 ${omitted} 字）…\n\n${text.slice(-tail)}`, omitted]
}

export function clipSession(session, { input = 1500, output = 2000, report = 6000, reasoning = 4000 } = {}) {
  const items = (session.items || []).map(item => {
    if (item.type === 'reasoning') return { ...item, text: clip(item.text, reasoning)[0] }
    if (item.type !== 'tool') return item
    const [clippedInput, inputOmitted] = clip(item.input, input)
    const [clippedOutput, outputOmitted] = clip(item.output, item.stats?.agent || item.stats?.reply ? report : output)
    const next = { ...item, input: clippedInput, output: clippedOutput }
    if (inputOmitted + outputOmitted) next.omitted = inputOmitted + outputOmitted
    for (const key of ['input', 'output']) if (next[key] === undefined) delete next[key]
    return next
  })
  return { ...session, items }
}

export function findLeaks(session) {
  const leaks = []
  const home = homedir()
  mapStrings(session, (text, path) => {
    if (home && text.includes(home)) leaks.push({ path, rule: '本机路径 / Home Path', match: home })
    for (const rule of rules) {
      for (const match of text.matchAll(rule.pattern)) {
        leaks.push({ path, rule: rule.name, match: match[0].slice(0, 60) })
      }
    }
    for (const rule of advisoryRules) {
      for (const match of text.matchAll(rule.pattern)) {
        leaks.push({ path, rule: rule.name, match: match[0].slice(0, 60) })
      }
    }
    return text
  })
  return leaks
}

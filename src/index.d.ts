export type AgentToolId = 'codex' | 'claude-code' | 'claude-ai' | 'workbuddy' | 'antigravity' | 'antigravity-app' | 'antigravity-cli' | (string & {})
export type PlayerLang = 'zh' | 'en'

export interface ContextRecord {
  id: string
  tag?: string
  title: string
  meta?: string
  tokEst?: number
  stepIndex?: number
  payload: string
  images?: string[]
}

export interface InitialContext {
  sys?: ContextRecord[]
  schema?: ContextRecord[]
  mem?: ContextRecord[]
  skill?: ContextRecord[]
}

export interface SessionFrame {
  time?: string
  img: string
  who?: 'you' | 'ai'
  label?: string
  w?: number
  h?: number
}

export interface SessionDeliverable {
  title: string
  source?: { path: string; sha256?: string }
  sessionSha256?: string
  availability?: 'verified' | 'export-copy' | 'missing'
  unavailableReason?: 'outside-root' | 'unreadable'
  href?: string
  meta?: string
  cover?: string
  portrait?: { href: string; cover?: string }
  previewSheet?: string
  previewColumns?: string[]
  revision?: { href: string; label: string } & (
    { page: number; linePrefix: string } | { sheet: string; cell: string }
  )
  preview?: { change?: { before: string; after: string } } & (
    { type: 'pdf'; pages: { src: string; width: number; height: number }[] }
    | { type: 'xlsx'; src: string; sheet: string; count: number; rows: string[][] }
  )
}

export interface SessionItem {
  type: 'user' | 'assistant' | 'reasoning' | 'tool' | 'compact'
  deliverables?: SessionDeliverable[]
  text?: string
  time?: string
  done?: string
  name?: string
  kind?: string
  summary?: string
  input?: string
  output?: string
  file?: string
  files?: string[]
  skill?: string
  agent?: string
  question?: boolean
  answer?: boolean
  contextTokens?: number
  images?: string[]
  omittedImages?: number
  stats?: Record<string, number>
  seq?: number
  trigger?: string
  preTokens?: number
  postTokens?: number
  droppedTokens?: number
}

export interface EncoreSession {
  tool: AgentToolId
  model?: string
  lang?: PlayerLang
  title: string
  description?: string
  started?: string
  ended?: string
  tokens?: number
  contextWindow?: number
  initialContext?: InitialContext
  frames?: SessionFrame[]
  deliverables?: SessionDeliverable[]
  items: SessionItem[]
}

export interface PrivacyLeak {
  path: string
  rule: string
  match: string
}

export interface BuildReplayOptions {
  assetRoots?: string[]
  tool?: AgentToolId
  outDir?: string
  lang?: PlayerLang | 'auto'
  title?: string
  description?: string
  from?: string
  to?: string
  images?: boolean
  imageWidth?: number
  clip?: number
  conversation?: string
  includeMemory?: boolean
}

export interface BuildReplayResult {
  mode: 'import' | 'rebuild'
  tool: AgentToolId
  toolLabel: string
  dir: string
  sessionFile: string
  session: EncoreSession
  leaks: PrivacyLeak[]
  assets: {
    indexHtml: string
    playerJs: string
    playerCss: string
  }
}

export interface DetectedInput {
  kind: 'replay-dir' | 'session-json' | 'raw-log'
  dir?: string
  sessionFile?: string
  tool?: AgentToolId
  files?: string[]
}

export interface RecentSessionSummary {
  tool: AgentToolId
  toolLabel: string
  file: string
  archived?: boolean
  mtimeMs: number
  timeLabel: string
  sizeKB: number
  preview: string
}

export const tools: Record<string, string>
export const DICTS: Record<PlayerLang, Record<string, string>>
export const waitThreshold: number
export const binSeconds: number

export function detectInput(targetPath: string): Promise<DetectedInput>
export function detectJsonlTool(filePath: string): Promise<AgentToolId>
export function scanRecentSessions(options?: {
  limit?: number
  codexDir?: string
  claudeDir?: string
  antigravityAppDir?: string
  antigravityCliDir?: string
  workbuddyDir?: string
}): Promise<RecentSessionSummary[]>

export function importRawSession(
  files: string | string[],
  options?: BuildReplayOptions
): Promise<BuildReplayResult>

export function rebuildReplayDir(
  dirOrSessionFile: string,
  options?: Pick<BuildReplayOptions, 'lang' | 'title' | 'description' | 'assetRoots'>
): Promise<BuildReplayResult>

export function buildReplay(
  inputs: string | string[],
  options?: BuildReplayOptions
): Promise<BuildReplayResult>

export function readJsonl(
  files: string | string[],
  options?: { from?: string; to?: string }
): Promise<Record<string, unknown>[]>

export function readCodex(records: Record<string, unknown>[], options?: { includeMemory?: boolean }): EncoreSession
export function readClaudeCode(records: Record<string, unknown>[], options?: { includeMemory?: boolean }): EncoreSession
export function readClaudeAi(data: unknown, options?: { conversation?: string }): EncoreSession
export function readWorkBuddy(records: Record<string, unknown>[]): EncoreSession

export function redactText(text: string): string
export function redactSession(session: EncoreSession): EncoreSession
export function clipSession(session: EncoreSession, limits?: { input?: number; output?: number }): EncoreSession
export function findLeaks(session: EncoreSession): PrivacyLeak[]

export function timeline(session: EncoreSession, options?: { lang?: PlayerLang | 'auto' }): Record<string, any>
export function buildPlayerData(
  session: EncoreSession,
  line?: Record<string, any>,
  options?: { baseUrl?: string; lang?: PlayerLang | 'auto' }
): Record<string, any>
export function renderPlayerWidget(
  session: EncoreSession,
  line?: Record<string, any>,
  options?: {
    baseUrl?: string
    lang?: PlayerLang | 'auto'
    backHref?: string
    backLabel?: string
    showLangToggle?: boolean
  }
): string
export function createSessionPlaybackModel(data: Record<string, any>): Record<string, any>
export function attachPlayerController(
  root: HTMLElement,
  rawData?: Record<string, any>,
  options?: {
    lang?: PlayerLang
    initialStep?: number
    onToggleLang?: (nextLang: PlayerLang, curStep: number) => void
  }
): Record<string, any> | null
export function createEncorePlayer(
  target: string | HTMLElement,
  sourceOrSession?: string | EncoreSession,
  options?: { baseUrl?: string; lang?: PlayerLang | 'auto'; initialStep?: number; backHref?: string; backLabel?: string; showLangToggle?: boolean }
): Promise<{ setLang: (nextLang: PlayerLang) => void; getController: () => Record<string, any> | null }>

export function buildStandalonePlayerJs(options?: { write?: boolean }): string
export function renderIndexHtml(options?: { title?: string; lang?: string; sessionSrc?: string }): string
export function writePlayerAssets(
  targetDir: string,
  options?: { title?: string; lang?: string; sessionSrc?: string }
): { indexHtml: string; playerJs: string; playerCss: string }

export function serveReplayDir(
  dir: string,
  options?: { port?: number; open?: boolean }
): Promise<{ server: import('node:http').Server; port: number; url: string }>
export function openBrowser(url: string): void

export function resolveLang(lang?: string): PlayerLang
export function createTranslator(lang?: string): ((key: string, vars?: Record<string, unknown>) => string) & {
  lang: PlayerLang
  dict: Record<string, string>
}
export function escapeHtml(str: unknown): string
export function renderMarkdown(text: unknown): string
export function cutSession(session: EncoreSession, window?: { from?: string; to?: string }): EncoreSession
export function deriveDefaultTitle(session: Partial<EncoreSession>): string
export function extractImages(
  session: EncoreSession,
  outDir: string,
  options?: { keep?: boolean; width?: number; lang?: PlayerLang }
): Promise<EncoreSession>
export function sumStats(items: SessionItem[]): Record<string, number>
export function describeStats(stats: Record<string, number>, lang?: PlayerLang | ((k: string, v?: any) => string)): string
export function kindOf(stats?: Record<string, number>): 'send' | 'back' | 'look' | 'make'
export function minutes(seconds?: number): number
export function wallClock(start: string, seconds?: number, withSeconds?: boolean): string
export function elapsedClock(seconds?: number): string

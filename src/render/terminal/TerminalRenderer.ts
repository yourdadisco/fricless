import type { Renderer, OutputMode } from '../RenderLayer.js';

const $ = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function toolLine(name: string, input: unknown): string {
  const q = (input as any)?.query;
  if (q) return `> Searching: "${q}"`;

  const url = (input as any)?.url;
  if (url) return `> Fetching: ${url}`;

  const task = (input as any)?.task;
  if (task) return `> Task: ${task.slice(0, 60)}`;

  const expr = (input as any)?.expression;
  if (expr) return `> Calculating: ${expr}`;

  const code = (input as any)?.code || (input as any)?.command;
  if (code) return `> Running: ${code.length > 50 ? code.slice(0, 50) + '…' : code}`;

  const path = (input as any)?.path;
  if (path) return `> ${path}`;

  const text = (input as any)?.text;
  if (text) return `> ${text.length > 50 ? text.slice(0, 50) + '…' : text}`;

  const message = (input as any)?.message;
  if (message) return `> ${message.slice(0, 50)}`;

  const lang = (input as any)?.language;
  if (lang && code) return `> Running ${lang}...`;

  const count = (input as any)?.count;
  if (name === 'uuid_gen') return `> Generating ${count || 1} UUIDs`;

  const algo = (input as any)?.algorithm;
  if (name === 'hash') return `> Hashing with ${algo || 'SHA256'}`;

  const target = (input as any)?.targetLanguage;
  if (target) return `> Translating to ${target}`;

  const pattern = (input as any)?.pattern;
  if (pattern) return `> Matching: ${pattern}`;

  const action = (input as any)?.action;
  if (action && typeof action === 'string') return `> ${action}...`;

  const nameMap: Record<string, string> = {
    datetime: '> Checking time', time: '> Checking time',
    calculator: '> Calculating', echo: '> Echoing',
    web_browser: '> Browsing', web_fetch: '> Fetching',
    bash: '> Running shell', powershell: '> Running powershell',
    code_run: '> Running code', sleep: '> Waiting',
    todo: '> Managing todos', notebook: '> Creating note',
  };
  return nameMap[name] || `> ${name.replace(/_/g, ' ')}...`;
}

export class TerminalRenderer implements Renderer {
  readonly mode: OutputMode = 'terminal';
  private buf = '';
  private toolActive = false;

  async text(content: string): Promise<void> {
    if (this.toolActive) { this.toolActive = false; process.stdout.write('\n'); }
    if (content) console.log(content);
  }

  async streamText(chunk: string, done: boolean): Promise<void> {
    if (this.toolActive) { this.toolActive = false; }
    if (done) { if (this.buf) { process.stdout.write('\n'); this.buf = ''; } }
    else { this.buf += chunk; process.stdout.write(chunk); }
  }

  async toolUse(name: string, input: unknown): Promise<void> {
    this.toolActive = true;
    process.stdout.write(`${$.dim}${toolLine(name, input)}${$.reset}`);
  }

  async toolResult(_name: string, _result: string, isError: boolean): Promise<void> {
    this.toolActive = false;
    process.stdout.write(isError ? ` ${$.red}✖${$.reset}\n` : `${$.green} ✓${$.reset}\n`);
  }

  async error(message: string): Promise<void> {
    if (this.toolActive) { this.toolActive = false; process.stdout.write('\n'); }
    console.log(`${$.red}${$.bold}✖${$.reset} ${message}`);
  }

  async markdown(content: string): Promise<void> {
    if (this.toolActive) { this.toolActive = false; process.stdout.write('\n'); }
    if (!content.trim()) return;
    const lines = content.split('\n');
    const out: string[] = [];
    let inCode = false;
    for (const line of lines) {
      if (/^```/.test(line)) { inCode = !inCode; continue; }
      if (inCode) { out.push(`  ${$.dim}${line}${$.reset}`); continue; }
      out.push(line
        .replace(/\*\*\*(.+?)\*\*\*/g, (_, p) => `${$.bold}${$.italic}${p}${$.reset}`)
        .replace(/\*\*(.+?)\*\*/g, (_, p) => `${$.bold}${p}${$.reset}`)
        .replace(/\*(.+?)\*/g, (_, p) => `${$.italic}${p}${$.reset}`)
        .replace(/`([^`]+)`/g, (_, p) => `${$.cyan}${p}${$.reset}`)
        .replace(/^### (.+)$/gm, (_, p) => `${$.bold}${p}${$.reset}`)
        .replace(/^## (.+)$/gm, (_, p) => `${$.yellow}${$.bold}${p}${$.reset}`)
        .replace(/^# (.+)$/gm, (_, p) => `${$.blue}${$.bold}${p}${$.reset}`));
    }
    console.log(out.join('\n'));
  }

  async list(items: string[], title?: string): Promise<void> {
    if (this.toolActive) { this.toolActive = false; process.stdout.write('\n'); }
    if (title) console.log(`\n${$.bold}${title}${$.reset}`);
    for (const item of items) console.log(`  • ${item}`);
  }

  async divider(): Promise<void> { process.stdout.write('\n'); }
}

import type { Renderer, OutputMode } from '../RenderLayer.js';

const $ = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

/** Like Claude Code: tool name → friendly action phrase */
function toolAction(name: string): string {
  const actions: Record<string, string> = {
    web_search: 'Searching the web',
    web_browser: 'Fetching page',
    web_fetch: 'Fetching URL',
    calculator: 'Calculating',
    datetime: 'Checking time',
    time: 'Checking time',
    bash: 'Running shell',
    powershell: 'Running powershell',
    code_run: 'Running code',
    read_file: 'Reading file',
    write_file: 'Writing file',
    edit_file: 'Editing file',
    glob: 'Searching files',
    grep: 'Searching text',
    task_create: 'Creating task',
    task_get: 'Getting task',
    task_list: 'Listing tasks',
    text_summarize: 'Summarizing',
    translate: 'Translating',
    hash: 'Hashing',
    uuid_gen: 'Generating UUID',
    base64: 'Encoding',
    json_tool: 'Processing JSON',
    todo: 'Managing todos',
    agent: 'Spawning agent',
    send_message: 'Sending message',
    notebook: 'Creating note',
    skill: 'Running skill',
    sleep: 'Waiting',
    echo: 'Echoing',
  };
  return actions[name] || `Running ${name.replace(/_/g, ' ')}`;
}

function toolDescription(name: string, input: unknown): string {
  if (name === 'web_search') return `"${(input as any)?.query || ''}"`;
  if (name === 'web_fetch' || name === 'web_browser') return `${(input as any)?.url || ''}`;
  if (name === 'calculator') return `${(input as any)?.expression || ''}`;
  if (name === 'bash' || name === 'powershell' || name === 'code_run') {
    const code = ((input as any)?.code || (input as any)?.command || '');
    return code.length > 50 ? code.slice(0, 50) + '…' : code;
  }
  if (name === 'read_file' || name === 'write_file' || name === 'edit_file') return `${(input as any)?.path || ''}`;
  if (name === 'glob') return `${(input as any)?.pattern || ''}`;
  if (name === 'grep') return `"${(input as any)?.pattern || ''}"`;
  if (name === 'text_summarize') {
    const text = ((input as any)?.text || '');
    return text.length > 50 ? text.slice(0, 50) + '…' : text;
  }
  if (name === 'translate') return `→ ${(input as any)?.targetLanguage || ''}`;
  if (name === 'hash') return `${(input as any)?.algorithm || ''}`;
  if (name === 'uuid_gen') return `${(input as any)?.count || 1} UUIDs`;
  if (name === 'agent') return `${((input as any)?.task || '').slice(0, 60)}`;
  return '';
}

export class TerminalRenderer implements Renderer {
  readonly mode: OutputMode = 'terminal';
  private buffer = '';
  private toolActive = false;

  async text(content: string): Promise<void> {
    if (this.toolActive) { this.toolActive = false; process.stdout.write('\n'); }
    if (content) console.log(content);
  }

  async streamText(chunk: string, done: boolean): Promise<void> {
    if (this.toolActive) { this.toolActive = false; }
    if (done) {
      if (this.buffer) { process.stdout.write('\n'); this.buffer = ''; }
    } else {
      this.buffer += chunk;
      process.stdout.write(chunk);
    }
  }

  async toolUse(name: string, input: unknown): Promise<void> {
    this.toolActive = true;
    const action = toolAction(name);
    const desc = toolDescription(name, input);
    const line = desc ? `> ${action} ${desc}...` : `> ${action}...`;
    process.stdout.write(`${$.dim}${line}${$.reset}`);
  }

  async toolResult(_name: string, _result: string, _isError: boolean): Promise<void> {
    this.toolActive = false;
    process.stdout.write(`${$.green} ✓${$.reset}\n`);
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
      if (/^```/.test(line)) {
        if (inCode) { out.push(`${$.reset}`); inCode = false; }
        else { inCode = true; }
        continue;
      }
      if (inCode) { out.push(`  ${$.dim}${line}${$.reset}`); continue; }

      let processed = line
        .replace(/\*\*\*(.+?)\*\*\*/g, (_, p) => `${$.bold}${$.italic}${p}${$.reset}`)
        .replace(/\*\*(.+?)\*\*/g, (_, p) => `${$.bold}${p}${$.reset}`)
        .replace(/\*(.+?)\*/g, (_, p) => `${$.italic}${p}${$.reset}`)
        .replace(/`([^`]+)`/g, (_, p) => `${$.cyan}${p}${$.reset}`)
        .replace(/^### (.+)$/gm, (_, p) => `${$.bold}${p}${$.reset}`)
        .replace(/^## (.+)$/gm, (_, p) => `${$.yellow}${$.bold}${p}${$.reset}`)
        .replace(/^# (.+)$/gm, (_, p) => `${$.blue}${$.bold}${p}${$.reset}`);

      out.push(processed);
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

import type { Renderer, OutputMode } from '../RenderLayer.js';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export class TerminalRenderer implements Renderer {
  readonly mode: OutputMode = 'terminal';
  private buffer = '';
  private toolRunning = false;

  async text(content: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    console.log(content);
  }

  async streamText(chunk: string, done: boolean): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; }
    if (done) {
      if (this.buffer) { process.stdout.write('\n'); this.buffer = ''; }
    } else {
      this.buffer += chunk;
      process.stdout.write(chunk);
    }
  }

  async toolUse(name: string, _input: unknown): Promise<void> {
    this.toolRunning = true;
    const icons: Record<string, string> = {
      web_search: '🔍', web_browser: '🌐', web_fetch: '📄',
      calculator: '🔢', datetime: '📅', time: '⏰',
      bash: '💻', powershell: '🪟', code_run: '▶',
      read_file: '📖', write_file: '📝', edit_file: '✏️',
      glob: '🔎', grep: '🔍',
      task_create: '📋', task_get: '📌', task_list: '📑',
      agent: '🤖', send_message: '💬',
      text_summarize: '📃', translate: '🌍', hash: '#️⃣',
      uuid_gen: '🆔', base64: '🔐', json_tool: '{ }',
      todo: '✅', notebook: '📓', skill: '⚡', sleep: '💤',
    };
    const icon = icons[name] || '🔧';
    process.stdout.write(`${colors.dim}${icon} ${name}...${colors.reset}`);
  }

  async toolResult(_name: string, _result: string, isError: boolean): Promise<void> {
    this.toolRunning = false;
    process.stdout.write(isError ? ` ${colors.red}✗${colors.reset}\n` : ` ${colors.green}✓${colors.reset}\n`);
  }

  async error(message: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    console.log(`${colors.red}${colors.bold}❌${colors.reset} ${message}\n`);
  }

  async markdown(content: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    const plain = content
      .replace(/\*\*(.+?)\*\*/g, (_, p1) => `${colors.bold}${p1}${colors.reset}`)
      .replace(/\*(.+?)\*/g, (_, p1) => `${colors.dim}${p1}${colors.reset}`)
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => `${colors.dim}${code.trim()}${colors.reset}`)
      .replace(/`(.+?)`/g, (_, p1) => `${colors.cyan}${p1}${colors.reset}`)
      .replace(/^### (.+)$/gm, (_, p1) => `\n${colors.bold}${p1}${colors.reset}`)
      .replace(/^## (.+)$/gm, (_, p1) => `\n${colors.bold}${colors.yellow}${p1}${colors.reset}`)
      .replace(/^# (.+)$/gm, (_, p1) => `\n${colors.bold}${colors.blue}${p1}${colors.reset}`)
      .replace(/^---$/gm, `${colors.gray}──────────────────────────────${colors.reset}`)
      .replace(/^\|/gm, ' ')
      .replace(/\|$/gm, ' ');
    console.log(plain);
  }

  async list(items: string[], title?: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    if (title) console.log(`${colors.bold}${title}${colors.reset}`);
    for (const item of items) console.log(`  ${colors.cyan}•${colors.reset} ${item}`);
    console.log('');
  }

  async divider(): Promise<void> {
    process.stdout.write('\n');
  }
}

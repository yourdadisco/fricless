import type { Renderer, OutputMode } from '../RenderLayer.js';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const icons: Record<string, string> = {
  web_search: '🔍', web_browser: '→', web_fetch: '↓',
  calculator: '', datetime: '', time: '',
  bash: '$', powershell: '>',
  read_file: '', write_file: '+', edit_file: '~',
  glob: '', grep: '',
  agent: '◈', send_message: '→',
  text_summarize: '∑', translate: '⇄',
  uuid_gen: '', hash: '#',
  todo: '☑', notebook: '📝',
};

function shortName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 20);
}

export class TerminalRenderer implements Renderer {
  readonly mode: OutputMode = 'terminal';
  private buffer = '';
  private toolRunning = false;
  private toolName = '';

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
    this.toolName = name;
    const icon = icons[name] || '·';
    const label = shortName(name);
    const prefix = icon ? `${icon} ` : '';
    process.stdout.write(`${colors.gray}${prefix}${label}...${colors.reset}`);
  }

  async toolResult(_name: string, _result: string, isError: boolean): Promise<void> {
    this.toolRunning = false;
    process.stdout.write(isError ? ` ${colors.red}✗${colors.reset}\n` : `${colors.green} ✓${colors.reset}\n`);
  }

  async error(message: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    console.log(`${colors.red}${colors.bold}✖${colors.reset} ${message}`);
  }

  async markdown(content: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    if (!content.trim()) return;

    // Process line by line for tables
    const lines = content.split('\n');
    const output: string[] = [];
    let inTable = false;
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code blocks
      if (/^```/.test(line)) {
        if (inCode) { output.push(`${colors.reset}${colors.gray}└${'─'.repeat(30)}${colors.reset}`); inCode = false; continue; }
        inCode = true;
        output.push(`${colors.gray}┌${'─'.repeat(30)}${colors.reset}`);
        continue;
      }
      if (inCode) { output.push(`  ${colors.dim}${line}${colors.reset}`); continue; }

      // Tables
      if (/^\|.+\|$/.test(line.trim()) && line.includes('|')) {
        if (line.includes('---')) {
          inTable = true;
          output.push(`${colors.gray}${line.replace(/\|/g, (m, idx) => idx === 0 ? '├' : idx === line.length-1 ? '┤' : '┼').replace(/-+/g, '─')}${colors.reset}`);
          continue;
        }
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        if (!inTable && cells.length > 0) {
          inTable = true;
          output.push(`${colors.gray}┌${cells.map(() => '───').join('┬')}┐${colors.reset}`);
        }
        output.push(`${colors.gray}│${colors.reset}${cells.map(c => ` ${c} `).join(`${colors.gray}│${colors.reset}`)}${colors.gray}│${colors.reset}`);
        continue;
      } else if (inTable && !/^\|/.test(line.trim())) {
        // End of table
        const lastTableLine = output[output.length - 1];
        if (lastTableLine) {
          const cellCount = (lastTableLine.match(/│/g) || []).length - 1;
          output.push(`${colors.gray}└${'───'.repeat(Math.max(1, cellCount))}┘${colors.reset}`);
        }
        inTable = false;
      }

      // Regular markdown
      line = line
        .replace(/\*\*(.+?)\*\*/g, (_, p1) => `${colors.bold}${p1}${colors.reset}`)
        .replace(/\*(.+?)\*/g, (_, p1) => `${colors.italic}${p1}${colors.reset}`)
        .replace(/`([^`]+)`/g, (_, p1) => `${colors.cyan}${p1}${colors.reset}`)
        .replace(/^### (.+)$/gm, (_, p1) => `${colors.bold}${p1}${colors.reset}`)
        .replace(/^## (.+)$/gm, (_, p1) => `\n${colors.bold}${colors.yellow}${p1}${colors.reset}`)
        .replace(/^# (.+)$/gm, (_, p1) => `\n${colors.bold}${colors.blue}${p1}${colors.reset}`);

      output.push(line);
    }

    // Close any open table
    if (inTable) {
      const lastLine = output[output.length - 1];
      if (lastLine) {
        const cellCount = (lastLine.match(/│/g) || []).length - 1;
        output.push(`${colors.gray}└${'───'.repeat(Math.max(1, cellCount))}┘${colors.reset}`);
      }
    }

    console.log(output.join('\n'));
  }

  async list(items: string[], title?: string): Promise<void> {
    if (this.toolRunning) { this.toolRunning = false; process.stdout.write('\n'); }
    if (title) console.log(`${colors.bold}${title}${colors.reset}`);
    for (const item of items) console.log(`  ${colors.cyan}•${colors.reset} ${item}`);
  }

  async divider(): Promise<void> {
    process.stdout.write('\n');
  }
}

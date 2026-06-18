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

  async text(content: string): Promise<void> {
    console.log(content);
  }

  async streamText(chunk: string, done: boolean): Promise<void> {
    if (done) {
      // 流结束：换行并清空缓冲区
      // 注意：文本已经通过逐块 process.stdout.write 输出，无需重复打印
      if (this.buffer) {
        process.stdout.write('\n');
        this.buffer = '';
      }
    } else {
      this.buffer += chunk;
      process.stdout.write(chunk);
    }
  }

  async toolUse(name: string, input: unknown): Promise<void> {
    console.log(`\n${colors.cyan}${colors.bold}🔧 [Tool: ${name}]${colors.reset}`);
    console.log(`${colors.dim}${JSON.stringify(input, null, 2)}${colors.reset}\n`);
  }

  async toolResult(name: string, result: string, isError: boolean): Promise<void> {
    if (isError) {
      console.log(`${colors.red}❌ Tool ${name} error:${colors.reset} ${result}\n`);
    } else {
      console.log(`${colors.green}✓ Tool ${name} completed${colors.reset}\n`);
    }
  }

  async error(message: string): Promise<void> {
    console.error(`${colors.red}${colors.bold}❌ Error:${colors.reset} ${message}\n`);
  }

  async markdown(content: string): Promise<void> {
    // Simple markdown rendering: strip formatting for terminal
    const plain = content
      .replace(/\*\*(.+?)\*\*/g, (_m, p1) => `${colors.bold}${p1}${colors.reset}`)
      .replace(/\*(.+?)\*/g, (_m, p1) => `${colors.dim}${p1}${colors.reset}`)
      .replace(/\`(.+?)\`/g, (_m, p1) => `${colors.cyan}${p1}${colors.reset}`)
      .replace(/^### (.+)$/gm, (_m, p1) => `\n${colors.bold}${p1}${colors.reset}\n`)
      .replace(/^## (.+)$/gm, (_m, p1) => `\n${colors.bold}${colors.yellow}${p1}${colors.reset}\n`)
      .replace(/^# (.+)$/gm, (_m, p1) => `\n${colors.bold}${colors.blue}${p1}${colors.reset}\n`);
    console.log(plain);
  }

  async list(items: string[], title?: string): Promise<void> {
    if (title) console.log(`\n${colors.bold}${title}${colors.reset}`);
    for (const item of items) {
      console.log(`  ${colors.cyan}•${colors.reset} ${item}`);
    }
    console.log('');
  }

  async divider(): Promise<void> {
    console.log(`${colors.gray}──────────────────────────────${colors.reset}`);
  }
}

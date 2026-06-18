import type { Renderer, OutputMode } from '../RenderLayer.js';

export class FeishuRenderer implements Renderer {
  readonly mode: OutputMode = 'feishu';

  constructor(
    private sendMessage: (chatId: string, content: string) => Promise<void>,
    private sendStream: (chatId: string, produce: (append: (chunk: string) => Promise<void>) => Promise<void>) => Promise<string>,
    private chatId: string,
  ) {}

  async text(content: string): Promise<void> {
    await this.sendMessage(this.chatId, content);
  }

  async streamText(chunk: string, done: boolean): Promise<void> {
    // For Feishu, use sendStream. This is handled specially in Harness.
    if (done) {
      // Stream complete - no action needed for single chunk flush
    }
  }

  async toolUse(name: string, input: unknown): Promise<void> {
    // Feishu: send tool use notification as markdown
    await this.sendMessage(this.chatId, `🔧 **调用工具:** ${name}
\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\``);
  }

  async toolResult(name: string, result: string, isError: boolean): Promise<void> {
    if (isError) {
      await this.sendMessage(this.chatId, `❌ **工具 ${name} 执行出错:**
${result}`);
    }
    // Success: result is appended to ongoing stream
  }

  async error(message: string): Promise<void> {
    await this.sendMessage(this.chatId, `❌ **错误:** ${message}`);
  }

  async markdown(content: string): Promise<void> {
    await this.sendMessage(this.chatId, content);
  }

  async list(items: string[], title?: string): Promise<void> {
    const lines = [title ? `**${title}**` : '', ...items.map(i => `• ${i}`)];
    await this.sendMessage(this.chatId, lines.filter(Boolean).join('\n'));
  }

  async divider(): Promise<void> {
    await this.sendMessage(this.chatId, '---');
  }
}

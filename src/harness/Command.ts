/**
 * Command 接口 — 斜杠命令系统
 *
 * 类比 Claude Code 的 Slash Command 系统。
 * 用于支持飞书场景下的 /help、/clear、/ping 等用户命令。
 */

export interface CommandContext {
  /** Session ID */
  sessionId: string;
  /** 用户 ID（飞书 Open ID） */
  userId: string;
  /** 来源群聊/私聊 ID */
  chatId?: string;
  /** 发送消息到通道 */
  sendMessage: (content: string) => Promise<void>;
}

export interface CommandDef {
  /** 命令名称（不含 /） */
  name: string;
  /** 命令别名 */
  aliases?: string[];
  /** 简短描述（显示在 /help 中） */
  description: string;
  /** 使用说明 */
  usage?: string;
  /** 执行逻辑 */
  execute: (args: string[], ctx: CommandContext) => Promise<void>;
}

export class Command {
  constructor(public def: CommandDef) {}

  get name() { return this.def.name; }
  get aliases() { return this.def.aliases ?? []; }
  get description() { return this.def.description; }

  matches(input: string): boolean {
    const normalized = input.toLowerCase().replace(/^\//, '');
    return normalized === this.name || this.aliases.includes(normalized);
  }

  async execute(raw: string, ctx: CommandContext): Promise<void> {
    // 去除 /command 前缀，解析 args
    const parts = raw.replace(/^\//, '').trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (!this.matches(raw)) return;
    await this.def.execute(args, ctx);
  }
}

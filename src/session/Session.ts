import type { Message, SessionId } from '../types/index.js';
import type { BuiltTool } from '../harness/Tool.js';
import type { AIProvider } from '../providers/types.js';

/**
 * Session 数据模型
 *
 * 一个 Session 对应一个独立的对话上下文（一个飞书用户/群聊）。
 * 拥有完整的消息历史、Tool 注册表和 Provider 配置。
 */
export class Session {
  readonly id: SessionId;
  readonly userId: string;
  readonly chatId?: string;

  /** 对话消息历史 */
  messages: Message[] = [];

  /** 创建时间 */
  readonly createdAt: Date;

  /** 最后活动时间 */
  lastActiveAt: Date;

  /** 关联的 AI Provider */
  provider: AIProvider | null = null;

  /** 该 Session 可用的 Tool 列表 */
  tools: BuiltTool<unknown, string>[] = [];

  /** 系统提示词 */
  systemPrompt: string;

  constructor(params: {
    id: SessionId;
    userId: string;
    chatId?: string;
    systemPrompt?: string;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.chatId = params.chatId;
    this.createdAt = new Date();
    this.lastActiveAt = new Date();
    this.systemPrompt = params.systemPrompt ?? '你是一个智能助手，请用中文回答用户的问题。';
  }

  /** 追加消息 */
  addMessage(msg: Message): void {
    this.messages.push(msg);
    this.lastActiveAt = new Date();
  }

  /** 清空历史 */
  clearMessages(): void {
    this.messages = [];
    this.lastActiveAt = new Date();
  }

  /** 获取上下文消息（含系统提示） */
  getContextMessages(): Message[] {
    const msgs: Message[] = [];

    // 系统提示
    if (this.systemPrompt) {
      msgs.push({ role: 'system', content: this.systemPrompt });
    }

    // 对话历史（取最近 N 条，防止超 Token）
    const maxHistory = 50;
    const recent = this.messages.slice(-maxHistory);
    msgs.push(...recent);

    return msgs;
  }

  /** 判断是否过期（1 小时无活动） */
  isExpired(): boolean {
    const now = Date.now();
    const idle = now - this.lastActiveAt.getTime();
    return idle > 60 * 60 * 1000; // 1 hour
  }

  /** 心跳保活 */
  touch(): void {
    this.lastActiveAt = new Date();
  }
}

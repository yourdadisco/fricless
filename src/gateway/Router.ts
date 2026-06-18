import pino from 'pino';
import type { InboundMessage } from '../channels/types.js';
import type { SessionId } from '../types/index.js';
import type { ISessionStore } from '../session/ISessionStore.js';
import type { Renderer } from '../render/RenderLayer.js';
import { Harness } from '../harness/Harness.js';
import type { AnyTool } from '../harness/Tool.js';
import type { CommandDef } from '../harness/Command.js';
import type { AIProvider } from '../providers/types.js';

const logger = pino({ name: 'router' });

export interface RouterOptions {
  /** 默认系统提示词 */
  systemPrompt?: string;
  /** 最大 Tool 往返次数 */
  maxToolRoundtrips?: number;
  /** 最大上下文 Token 数 */
  maxContextTokens?: number;
}

/**
 * Router — 消息路由
 *
 * 职责:
 * 1. 将通道入站消息映射到对应 Session
 * 2. 为每个 Session 创建/复用 Harness 实例
 * 3. 分发消息到 Harness 处理
 *
 * 路由策略（飞书）:
 * - 私聊: session_id = `p2p:{user_open_id}`
 * - 群聊: session_id = `group:{chat_id}:{user_open_id}`
 *   （群聊中每个用户独立 Session，便于隔离上下文）
 */
export class Router {
  private sessionStore: ISessionStore;
  private toolRegistry: AnyTool[];
  private commandDefs: CommandDef[];
  private providerFactory: () => AIProvider;
  private options: Required<RouterOptions>;
  private rendererFactory: (chatId: string) => Renderer;

  /** 缓存: sessionId → Harness */
  private harnessCache = new Map<SessionId, Harness>();

  constructor(params: {
    sessionStore: ISessionStore;
    tools: AnyTool[];
    commands: CommandDef[];
    providerFactory: () => AIProvider;
    rendererFactory: (chatId: string) => Renderer;
    options?: RouterOptions;
  }) {
    this.sessionStore = params.sessionStore;
    this.toolRegistry = params.tools;
    this.commandDefs = params.commands;
    this.providerFactory = params.providerFactory;
    this.rendererFactory = params.rendererFactory;
    this.options = {
      systemPrompt: params.options?.systemPrompt ?? '你是一个智能助手，请用中文回答用户的问题。',
      maxToolRoundtrips: params.options?.maxToolRoundtrips ?? 10,
      maxContextTokens: params.options?.maxContextTokens ?? 32000,
    };
  }

  /** 路由一条入站消息 */
  async route(msg: InboundMessage): Promise<void> {
    const sessionId = this.resolveSessionId(msg);

    // 获取或创建 Session
    const session = this.sessionStore.getOrCreate({
      id: sessionId,
      userId: msg.userId,
      chatId: msg.chatId,
      systemPrompt: this.options.systemPrompt,
    });

    // 获取或创建 Harness
    const harness = this.getOrCreateHarness(session, msg.chatId);

    logger.info({ sessionId, userId: msg.userId, text: msg.text }, '路由消息');

    // 分发到 Harness
    await harness.handleUserMessage(msg.text);
  }

  /** 解析 Session ID */
  private resolveSessionId(msg: InboundMessage): SessionId {
    // 简单策略：私聊用 user_id，群聊用 chat_id:user_id
    // 后续可扩展为可配置路由规则
    return `${msg.chatId ?? 'p2p'}:${msg.userId}`;
  }

  /** 获取或创建 Harness */
  private getOrCreateHarness(session: import('../session/Session.js').Session, chatId?: string): Harness {
    const existing = this.harnessCache.get(session.id);
    if (existing) {
      // 更新 session 引用（可能已变化）
      return existing;
    }

    const provider = this.providerFactory();

    const harness = new Harness({
      session,
      provider,
      tools: this.toolRegistry,
      commandDefs: this.commandDefs,
      renderer: this.rendererFactory(chatId ?? session.id),
      chatId: chatId ?? session.id,
      options: {
        systemPrompt: this.options.systemPrompt,
        maxToolRoundtrips: this.options.maxToolRoundtrips,
        maxContextTokens: this.options.maxContextTokens,
      },
    });

    this.harnessCache.set(session.id, harness);
    return harness;
  }

  /** 清理过期 Session */
  cleanExpired(): number {
    const cleaned = this.sessionStore.cleanExpired();
    // 同步清理 Harness 缓存：移除已过期 Session 对应的 Harness
    for (const [sid] of this.harnessCache) {
      if (!this.sessionStore.get(sid)) {
        this.harnessCache.delete(sid);
      }
    }
    return cleaned;
  }
}

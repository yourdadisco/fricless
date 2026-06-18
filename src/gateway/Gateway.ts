import pino from 'pino';
import type { Channel } from '../channels/types.js';
import { Router } from './Router.js';
import { InMemorySessionStore } from '../session/InMemorySessionStore.js';
import type { AnyTool } from '../harness/Tool.js';
import type { CommandDef } from '../harness/Command.js';
import type { AIProvider } from '../providers/types.js';
import type { ISessionStore } from '../session/ISessionStore.js';
import { FeishuRenderer } from '../render/feishu/FeishuRenderer.js';
import type { Renderer } from '../render/RenderLayer.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'gateway' });

export interface GatewayOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大 Tool 往返次数 */
  maxToolRoundtrips?: number;
  /** 过期清理间隔（毫秒） */
  cleanupIntervalMs?: number;
}

/**
 * Gateway — 控制平面
 *
 * 类比 OpenClaw 的 Gateway 核心。
 * 职责:
 * 1. 管理通道生命周期（启动/停止通道）
 * 2. 初始化核心组件（Session Store、Router）
 * 3. 定期清理过期 Session
 * 4. 提供优雅关闭
 *
 * 架构位置:
 *   外部消息 → Channel → Router → Harness → AI Provider
 *                                      ↓
 *                                Tool System
 */
export class Gateway {
  private channels: Channel[] = [];
  private sessionStore: ISessionStore;
  private router: Router;
  private options: Required<GatewayOptions>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private _isRunning = false;

  constructor(params: {
    tools: AnyTool[];
    commands: CommandDef[];
    providerFactory: () => AIProvider;
    options?: GatewayOptions;
    /** 可选的共享 SessionStore 实例（未传则自动创建 InMemorySessionStore） */
    sessionStore?: ISessionStore;
    /** 可选的 Renderer 工厂（未传则默认使用 FeishuRenderer） */
    rendererFactory?: (chatId: string) => Renderer;
  }) {
    this.sessionStore = params.sessionStore ?? new InMemorySessionStore();
    this.options = {
      systemPrompt: params.options?.systemPrompt ?? '你是一个智能助手，请用中文回答用户的问题。',
      maxToolRoundtrips: params.options?.maxToolRoundtrips ?? 10,
      cleanupIntervalMs: params.options?.cleanupIntervalMs ?? 5 * 60 * 1000, // 5分钟
    };

    const rendererFactory = params.rendererFactory ?? ((chatId) => new FeishuRenderer(
      (cid, content) => this.broadcast(cid, content),
      (cid, produce) => this.broadcastStream(cid, produce),
      chatId,
    ));

    // 创建 Router
    this.router = new Router({
      sessionStore: this.sessionStore,
      tools: params.tools,
      commands: params.commands,
      providerFactory: params.providerFactory,
      rendererFactory,
      options: {
        systemPrompt: this.options.systemPrompt,
        maxToolRoundtrips: this.options.maxToolRoundtrips,
      },
    });
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get activeSessions(): number {
    return this.sessionStore.activeCount;
  }

  /** 注册通道 */
  registerChannel(channel: Channel): void {
    this.channels.push(channel);

    // 绑定消息处理器到 Router
    channel.onMessage(async (msg) => {
      try {
        await this.router.route(msg);
      } catch (err) {
        logger.error({ err, msg }, '路由消息失败');
      }
    });

    logger.info({ channelName: channel.name }, '通道已注册');
  }

  /** 启动 Gateway */
  async start(): Promise<void> {
    logger.info('Gateway 启动中...');
    this._isRunning = true;

    // 启动所有已注册通道
    for (const channel of this.channels) {
      try {
        await channel.connect();
        logger.info({ channel: channel.name }, '通道已连接');
      } catch (err) {
        logger.error({ err, channel: channel.name }, '通道连接失败');
      }
    }

    // 启动过期 Session 清理
    this.cleanupTimer = setInterval(() => {
      const cleaned = this.router.cleanExpired();
      if (cleaned > 0) {
        logger.info({ cleaned }, '已清理过期 Session');
      }
    }, this.options.cleanupIntervalMs);

    logger.info({
      channels: this.channels.map(c => c.name),
      sessions: this.activeSessions,
    }, 'Gateway 启动完成');
  }

  /** 停止 Gateway */
  async stop(): Promise<void> {
    logger.info('Gateway 正在停止...');
    this._isRunning = false;

    // 停止清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 断开所有通道
    for (const channel of this.channels) {
      try {
        await channel.disconnect();
        logger.info({ channel: channel.name }, '通道已断开');
      } catch (err) {
        logger.error({ err, channel: channel.name }, '通道断开失败');
      }
    }

    logger.info('Gateway 已停止');
  }

  /** 广播消息到所有通道 */
  private async broadcast(chatId: string, content: string): Promise<void> {
    const results = await Promise.allSettled(
      this.channels.map(ch => ch.send ? ch.send(chatId, content) : Promise.resolve()),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({ err: result.reason }, '广播消息失败');
      }
    }
  }

  /** 广播流式消息到所有通道（使用第一个支持 sendStream 的通道） */
  private async broadcastStream(
    chatId: string,
    produce: (append: (chunk: string) => Promise<void>) => Promise<void>,
  ): Promise<string> {
    const streamChannel = this.channels.find(ch => ch.sendStream);
    if (streamChannel?.sendStream) {
      return streamChannel.sendStream(chatId, produce);
    }
    // 回退：累积后以文本形式发送
    let content = '';
    await produce(async (chunk) => {
      content += chunk;
    });
    await this.broadcast(chatId, content);
    return content;
  }
}

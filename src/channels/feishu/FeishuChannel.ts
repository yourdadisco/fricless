import { createLarkChannel, LoggerLevel } from '@larksuiteoapi/node-sdk';
import pino from 'pino';
import type { Channel, InboundMessage, MessageHandler, ChannelStatus, ContentBlock } from '../types.js';

const logger = pino({ name: 'feishu-channel' });

/**
 * 飞书通道适配器
 *
 * 使用 @larksuiteoapi/node-sdk 的 Channel 模块（createLarkChannel）：
 * - WebSocket 长连接（无需公网 URL/域名/ngrok）
 * - 内置自动重连
 * - 标准化消息事件（NormalizedMessage）
 * - Markdown/卡片消息发送
 * - 内置流式输出支持（channel.stream）
 *
 * 参考:
 * https://open.feishu.cn/document/server-side-sdk/nodejs-sdk
 */
export class FeishuChannel implements Channel {
  readonly name = 'feishu';

  private larkChannel: Awaited<ReturnType<typeof createLarkChannel>> | null = null;
  private _status: ChannelStatus = 'disconnected';
  private _onMessage: MessageHandler | null = null;
  private appId: string;
  private appSecret: string;

  constructor(appId: string, appSecret: string) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  get status(): ChannelStatus {
    return this._status;
  }

  onMessage(handler: MessageHandler): void {
    this._onMessage = handler;
  }

  async connect(): Promise<void> {
    this._status = 'connecting';
    logger.info('正在连接飞书 WebSocket...');

    try {
      const channel = await createLarkChannel({
        appId: this.appId,
        appSecret: this.appSecret,
        loggerLevel: LoggerLevel.info,
        policy: {
          requireMention: true,     // 群聊需要 @ 机器人
          dmMode: 'open',           // 私聊直接开放
        },
      });

      this.larkChannel = channel;

      // 注册消息处理器
      channel.on('message', async (msg) => {
        await this.handleLarkMessage(msg);
      });

      // 监控通道事件
      channel.on('reconnecting', () => {
        logger.warn('飞书 WebSocket 重连中...');
        this._status = 'connecting';
      });

      channel.on('reconnected', () => {
        logger.info('飞书 WebSocket 重连成功');
        this._status = 'connected';
      });

      channel.on('error', (err) => {
        logger.error({ err }, '飞书通道错误');
      });

      // 建立 WebSocket 连接
      await channel.connect();
      this._status = 'connected';
      logger.info('飞书 WebSocket 连接成功');
    } catch (err) {
      this._status = 'error';
      logger.error({ err }, '飞书 WebSocket 连接失败');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.larkChannel) {
      await this.larkChannel.disconnect();
      this.larkChannel = null;
    }
    this._status = 'disconnected';
    logger.info('飞书通道已断开');
  }

  async send(chatId: string, content: string): Promise<void> {
    if (!this.larkChannel) {
      throw new Error('飞书通道未连接');
    }

    try {
      await this.larkChannel.send(chatId, { markdown: content });
    } catch (err) {
      logger.error({ err, chatId }, '发送飞书消息失败');
      throw err;
    }
  }

  /**
   * 流式发送消息（Phase 2 支持）
   * 利用飞书 Channel SDK 内置的 typewriter 动画效果
   *
   * 用法:
   * ```
   * const finalContent = await channel.sendStream(chatId, async (append) => {
   *   for await (const chunk of aiStream) {
   *     await append(chunk);
   *   }
   * });
   * ```
   */
  async sendStream(
    chatId: string,
    produce: (append: (chunk: string) => Promise<void>) => Promise<void>,
  ): Promise<string> {
    if (!this.larkChannel) {
      throw new Error('飞书通道未连接');
    }

    let finalContent = '';
    await this.larkChannel.stream(chatId, {
      markdown: async (s) => {
        await produce(async (chunk) => {
          await s.append(chunk);
          finalContent += chunk;
        });
      },
    });

    return finalContent;
  }

  /**
   * 下载飞书消息中的媒体资源（图片/文件等）
   *
   * 使用 @larksuiteoapi/node-sdk 的 LarkChannel.downloadResource API，
   * 获取资源二进制数据并转换为 base64 编码，同时判断合适的媒体类型。
   *
   * @param fileKey - 资源的 fileKey（来自 NormalizedMessage.resources[].fileKey）
   * @param type - 资源类型（'image' | 'file'），与 SDK downloadResource 签名一致
   * @returns base64 编码的资源数据和推断的媒体类型
   */
  private async getResource(
    fileKey: string,
    type: 'image' | 'file',
  ): Promise<{ base64: string; mediaType: string }> {
    if (!this.larkChannel) {
      throw new Error('飞书通道未连接');
    }

    const buffer = await this.larkChannel.downloadResource(fileKey, type);

    // 根据类型推断媒体类型（SDK downloadResource 不返回原始 MIME 信息）
    const mediaType = type === 'image' ? 'image/png' : 'application/octet-stream';

    return {
      base64: buffer.toString('base64'),
      mediaType,
    };
  }

  /** 处理 SDK 标准化的消息事件 */
  private async handleLarkMessage(msg: any): Promise<void> {
    try {
      // SDK 的 NormalizedMessage 包含标准字段
      const messageId: string = msg.messageId;
      const chatId: string = msg.chatId;
      const senderId: string = msg.senderId || 'unknown';
      const content: string = msg.content || '';

      // 构造标准化入站消息
      const inbound: InboundMessage = {
        userId: senderId,
        chatId,
        text: content,
        messageId,
        isMention: true, // SDK policy 已处理 mention 过滤，到这里的都是有效消息
        raw: msg,
      };

      // 检测并处理多媒体资源（图片/文件等）
      // NormalizedMessage.resources 由 SDK 自动解析，包含 fileKey 和类型信息
      const resources: Array<{ type: string; fileKey: string; fileName?: string }> = msg.resources;
      if (resources && resources.length > 0) {
        const contentBlocks: ContentBlock[] = [];

        for (const resource of resources) {
          try {
            // SDK downloadResource 只支持 'image' 和 'file' 两种 ResourceType
            if (resource.type === 'image' || resource.type === 'file') {
              const { base64, mediaType } = await this.getResource(resource.fileKey, resource.type);

              if (resource.type === 'image') {
                contentBlocks.push({
                  type: 'image',
                  image: { base64, mediaType },
                });
              } else {
                contentBlocks.push({
                  type: 'file',
                  file: {
                    name: resource.fileName || 'file',
                    mimeType: mediaType,
                    data: base64,
                  },
                });
              }
            }
          } catch (err) {
            // 单个资源下载失败不影响其他资源的处理
            logger.error({ err, fileKey: resource.fileKey, type: resource.type }, '下载消息资源失败');
          }
        }

        if (contentBlocks.length > 0) {
          inbound.contentBlocks = contentBlocks;
        }
      }

      if (this._onMessage) {
        await this._onMessage(inbound);
      }
    } catch (err) {
      logger.error({ err }, '处理飞书消息失败');
    }
  }
}

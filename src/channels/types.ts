/**
 * Channel 接口 — 通道适配器基类
 *
 * 每个消息平台（飞书、微信、Discord 等）实现此接口，
 * Gateway 通过此接口统一管理不同通道。
 *
 * 类比 OpenClaw 的 Channel Adapter 模式。
 */

/** 入站消息（通道原始消息 → 标准化格式） */
export interface InboundMessage {
  /** 发送者 ID（平台用户 ID） */
  userId: string;
  /** 会话/群聊 ID */
  chatId?: string;
  /** 消息内容 */
  text: string;
  /** 消息 ID */
  messageId: string;
  /** 是否为 @机器人 消息 */
  isMention: boolean;
  /** 可选：多媒体内容块（图片/文件等） */
  contentBlocks?: ContentBlock[];
  /** 原始消息体（调试用） */
  raw: unknown;
}

/** 消息处理器回调 */
export type MessageHandler = (msg: InboundMessage) => Promise<void>;

import type { ContentBlock as _ContentBlock } from '../types/index.js';
export type ContentBlock = _ContentBlock;

/** 通道状态 */
export type ChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** 通道适配器接口 */
export interface Channel {
  /** 通道名称标识 */
  readonly name: string;

  /** 当前状态 */
  readonly status: ChannelStatus;

  /** 设置消息处理器 */
  onMessage(handler: MessageHandler): void;

  /** 连接通道 */
  connect(): Promise<void>;

  /** 断开连接 */
  disconnect(): Promise<void>;

  /** 发送消息到通道 */
  send(chatId: string, content: string): Promise<void>;

  /** 发送流式消息（逐块更新，飞书卡片打字机效果） */
  sendStream(chatId: string, produce: (append: (chunk: string) => Promise<void>) => Promise<void>): Promise<string>;
}

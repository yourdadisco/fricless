/**
 * PluginInterface — 插件系统接口定义
 *
 * 插件系统允许第三方以标准化的方式扩展 Fricless 功能。
 * 每个插件是一个对象，实现 FriclessPlugin 接口。
 *
 * 生命周期:
 *   1. load       → 构造插件实例
 *   2. initialize → 初始化（异步，可注册工具/命令/监听器）
 *   3. runtime    → 插件通过 hooks 参与消息处理
 *   4. destroy    → 清理资源
 */

import type { AnyTool } from '../harness/Tool.js';
import type { CommandDef } from '../harness/Command.js';
import type { InboundMessage } from '../channels/types.js';
import { EventBus } from './EventBus.js';

/** 插件元数据 */
export interface PluginMeta {
  /** 插件名称（全局唯一，建议 scope/name 格式） */
  name: string;
  /** 语义化版本号 */
  version: string;
  /** 简短描述 */
  description: string;
  /** 作者（可选） */
  author?: string;
  /** 依赖的其他插件名称列表（可选） */
  dependencies?: string[];
}

/** 插件运行时上下文 */
export interface PluginContext {
  /** 日志记录器（预配置了插件名前缀） */
  logger: {
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
    debug: (msg: string, ...args: unknown[]) => void;
  };
  /** 全局配置（只读快照） */
  config: Record<string, unknown>;
  /** 事件总线 */
  eventBus: EventBus;
}

/** 插件接口 */
export interface FriclessPlugin {
  /** 插件元数据 */
  meta: PluginMeta;

  /**
   * 插件初始化（异步）
   * 在插件加载后调用。插件应在此处注册工具、命令和事件监听器。
   */
  initialize?(ctx: PluginContext): Promise<void>;

  /**
   * 插件销毁（异步）
   * 在插件卸载前调用。插件应在此处清理所有资源（定时器、连接等）。
   */
  destroy?(): Promise<void>;

  /**
   * 注册工具
   * 返回该插件提供的所有 Tool 定义。
   */
  registerTools?(): AnyTool[];

  /**
   * 注册命令
   * 返回该插件提供的所有斜杠命令。
   */
  registerCommands?(): CommandDef[];

  /**
   * 消息预处理 Hook
   * 在消息路由到 AI 之前调用。
   * 返回 null 表示拦截该消息（不继续处理）。
   * 返回修改后的消息继续处理。
   */
  onBeforeMessage?(msg: InboundMessage): Promise<InboundMessage | null>;

  /**
   * 响应后处理 Hook
   * 在 AI 生成响应后调用。
   */
  onAfterMessage?(
    msg: InboundMessage,
    response: string,
  ): Promise<void>;
}

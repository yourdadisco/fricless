import crypto from 'node:crypto';
import { Harness, type HarnessOptions } from '../harness/Harness.js';
import type { AIProvider } from '../providers/types.js';
import type { AnyTool } from '../harness/Tool.js';
import type { CommandDef } from '../harness/Command.js';
import type { Renderer } from '../render/RenderLayer.js';
import { Session } from '../session/Session.js';

/**
 * Agent 包装器配置
 */
export interface AgentConfig {
  /** Agent 名称标识 */
  name: string;
  /** Agent 职责描述（供 Coordinator 调度参考） */
  description: string;
  /** AI Provider 实例 */
  provider: AIProvider;
  /** Agent 可用的 Tool 列表 */
  tools: AnyTool[];
  /** 斜杠命令定义 */
  commandDefs: CommandDef[];
  /** Harness 选项 */
  options?: HarnessOptions;
  /** Renderer 实例 */
  renderer: Renderer;
}

export interface AgentInstance {
  name: string;
  description: string;
  session: Session;
  harness: Harness;
}

/**
 * createAgent — 创建 Agent 实例
 */
export function createAgent(config: AgentConfig): AgentInstance {
  const session = new Session({
    id: crypto.randomUUID(),
    userId: `agent:${config.name}`,
    systemPrompt: config.options?.systemPrompt,
  });

  const harness = new Harness({
    session,
    provider: config.provider,
    tools: config.tools,
    commandDefs: config.commandDefs,
    renderer: config.renderer,
    chatId: config.name,
    options: config.options,
  });

  return {
    name: config.name,
    description: config.description,
    session,
    harness,
  };
}

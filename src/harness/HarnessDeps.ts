/**
 * HarnessDeps — Claude Code 的 query/deps.ts 移植
 *
 * 依赖注入容器，使 Harness 可测试。
 */
import crypto from 'node:crypto';
import type { AIProvider, ToolDescriptor } from '../providers/types.js';
import type { StreamResult } from '../types/index.js';
import type { StreamingToolExecutor } from './StreamingToolExecutor.js';

export interface HarnessDeps {
  /** 调用 AI 模型 */
  callModel: (messages: import('../types/index.js').Message[], tools: ToolDescriptor[]) => StreamResult;
  /** 生成 UUID */
  uuid: () => string;
}

/** 生产环境依赖 */
export function productionDeps(provider: AIProvider): HarnessDeps {
  return {
    callModel: (messages, tools) => provider.stream(messages, tools),
    uuid: () => crypto.randomUUID(),
  };
}

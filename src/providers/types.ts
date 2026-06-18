import type { StreamResult, Message } from '../types/index.js';

/** AI Provider 的通用配置 */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  vendor?: string;
  baseUrl?: string;
  maxTokens: number;
}

/** AI Provider 接口 — 所有 AI 模型后端的统一抽象 */
export interface AIProvider {
  /** 提供商名称标识 */
  readonly name: string;
  /** 提供商厂商标识 */
  readonly vendor: string;

  /** 发送消息并获取流式响应（Tool Use 事件通过流式事件传递） */
  stream(messages: Message[], tools: ToolDescriptor[]): StreamResult;

  /** 估算消息列表的 Token 数 */
  countTokens(messages: Message[]): number;

  /** 健康检查 */
  healthCheck(): Promise<boolean>;

  /** 获取当前模型信息 */
  getModelInfo(): ModelInfo;
}

/** 模型信息 */
export interface ModelInfo {
  name: string;
  vendor: string;
  maxContextTokens: number;
  features: string[];
}

/** Provider 支持的特性 */
export type ProviderFeature = 'streaming' | 'tool_use' | 'vision';

/** 暴露给 Provider 的 Tool 描述（只有 Schema，没有实现） */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

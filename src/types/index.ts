/** 通用的 Maybe 类型 */
export type Maybe<T> = T | null | undefined;

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** 多媒体内容块 */
export interface ContentBlock {
  type: 'text' | 'image' | 'file';
  text?: string;
  image?: {
    base64: string;
    mediaType: string;
  };
  file?: {
    name: string;
    mimeType: string;
    data: string; // base64
  };
}

/** 对话消息 */
export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  /** Tool call ID (tool result 消息必填) */
  toolCallId?: string;
  /** Tool 名称 (tool result 消息必填) */
  toolName?: string;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

/** 流式事件 */
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown>; id: string }
  | { type: 'tool_result'; name: string; result: string; id: string }
  | { type: 'error'; message: string }
  | { type: 'done'; content: string };

/** 流式生成器的产出类型 */
export type StreamResult = AsyncIterable<StreamEvent>;

/** Session ID 类型 */
export type SessionId = string;

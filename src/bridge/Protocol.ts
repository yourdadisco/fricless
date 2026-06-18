/**
 * Bridge Protocol — 远程控制 WebSocket 协议类型定义
 *
 * 桥接协议允许外部客户端（远程控制端）连接 Fricless 实例，
 * 接收实时事件并发送控制指令。
 *
 * ── 事件（Server → Client） ──
 *   message         – 用户/助理发送了一条消息
 *   response_chunk  – AI 响应的流式片段
 *   tool_call       – AI 发起了一个 Tool 调用
 *   error           – 系统产生了错误
 *   stats           – 周期性统计推送
 *
 * ── 命令（Client → Server） ──
 *   send_message    – 向指定通道发送消息（模拟用户输入）
 *   clear_session   – 清空指定 Session
 *   ping            – 心跳检测
 */

// ── 事件类型 ──────────────────────────────────────────────────

/** 消息事件 */
export interface MessageEvent {
  type: 'message';
  payload: {
    sessionId: string;
    userId: string;
    chatId?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  };
}

/** 流式响应事件 */
export interface ResponseChunkEvent {
  type: 'response_chunk';
  payload: {
    sessionId: string;
    delta: string;
    done: boolean;
  };
}

/** Tool 调用事件 */
export interface ToolCallEvent {
  type: 'tool_call';
  payload: {
    sessionId: string;
    toolName: string;
    input: Record<string, unknown>;
    timestamp: string;
  };
}

/** 系统错误事件 */
export interface ErrorEvent {
  type: 'error';
  payload: {
    code: string;
    message: string;
    timestamp: string;
  };
}

/** 统计快照事件 */
export interface StatsEvent {
  type: 'stats';
  payload: Record<string, unknown>;
}

/** Tool 审批事件（用户批准 Tool 执行） */
export interface ToolApprovalEvent {
  type: 'approve_tool';
  payload: {
    toolCallId: string;
    sessionId: string;
  };
}

/** Tool 拒绝事件（用户拒绝 Tool 执行） */
export interface ToolRejectionEvent {
  type: 'reject_tool';
  payload: {
    toolCallId: string;
    sessionId: string;
    reason?: string;
  };
}

/** 会话快照事件 */
export interface SessionSnapshotEvent {
  type: 'session_snapshot';
  payload: {
    sessions: SessionInfo[];
  };
}

/** 会话信息 */
export interface SessionInfo {
  id: string;
  userId: string;
  chatId?: string;
  messageCount: number;
  createdAt: string;
  lastActiveAt: string;
}

/** 所有事件的联合类型 */
export type BridgeEvent =
  | MessageEvent
  | ResponseChunkEvent
  | ToolCallEvent
  | ErrorEvent
  | StatsEvent
  | ToolApprovalEvent
  | ToolRejectionEvent
  | SessionSnapshotEvent;

// ── 命令类型 ──────────────────────────────────────────────────

/** 发送消息命令 */
export interface SendMessageCommand {
  type: 'send_message';
  payload: {
    /** 目标通道标识 */
    channel: string;
    /** 消息文本 */
    text: string;
    /** 可选 Session ID（不传则自动创建） */
    sessionId?: string;
  };
}

/** 清空 Session 命令 */
export interface ClearSessionCommand {
  type: 'clear_session';
  payload: {
    sessionId: string;
  };
}

/** 心跳命令 */
export interface PingCommand {
  type: 'ping';
  payload: Record<string, never>;
}

/** 所有命令的联合类型 */
export type BridgeCommand =
  | SendMessageCommand
  | ClearSessionCommand
  | PingCommand;

// ── 命令响应 ──────────────────────────────────────────────────

/** 命令执行结果 */
export interface CommandResult {
  type: 'command_result';
  requestId?: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

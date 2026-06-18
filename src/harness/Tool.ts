import { z } from 'zod';
import { zodToJsonSchema as zodToJson } from 'zod-to-json-schema';
import type { Message } from '../types/index.js';

// ── 类型擦除（用于 Tool 注册表存储） ──────────────────────

/** Tool 注册表使用的 AnyTool 类型（擦除输入/输出泛型） */
export type AnyTool = BuiltTool<any, string>;

// ── Tool 执行上下文 ──────────────────────────────────────

export interface ToolContext {
  /** Session ID */
  sessionId: string;
  /** 当前用户的标识（飞书 Open ID） */
  userId: string;
  /** 消息来源（群聊 ID 或私聊标识） */
  chatId?: string;
  /** 发送消息到用户（用于 Tool 主动输出） */
  sendMessage: (content: string) => Promise<void>;
  /** 中断信号（外部触发 Tool 取消） */
  signal?: AbortSignal;
}

// ── Tool 结果 ─────────────────────────────────────────────

export interface ToolResult<TOutput = string> {
  /** Tool 执行返回的数据 */
  data: TOutput;
  /** 可选：追加到对话的消息（Tool 产生的额外上下文） */
  extraMessages?: Message[];
  /** Tool 产生的独立新消息（用于 Tool 主动发消息的场景） */
  newMessages?: Message[];
  /** 是否执行成功 */
  isError?: boolean;
}

// ── 权限级别 ──────────────────────────────────────────────

export type PermissionLevel = 'auto' | 'confirm' | 'deny';

// ── 中断行为 ─────────────────────────────────────────────

export type InterruptBehavior = 'cancel' | 'block';

// ── Tool 定义（含 Claude Code 级别属性） ─────────────────

export interface ToolDef<TInput = unknown, TOutput = string> {
  /** Tool 唯一名称（AI 通过此名称调用） */
  name: string;
  /** 别名字符串（向后兼容） */
  aliases?: string[];
  /** Tool 描述（影响 AI 的判断，请写清楚） */
  description: string;
  /** 检索关键词（用于 Tool 搜索发现，3-10 词，无句号） */
  searchHint?: string;
  /** Zod input schema */
  inputSchema: z.ZodType<TInput>;
  /** 核心执行逻辑 */
  call: (input: TInput, ctx: ToolContext) => Promise<ToolResult<TOutput>>;
  /** 是否只读（不影响外部状态） */
  isReadOnly?: boolean;
  /** 是否并发安全（可与其他 Tool 并行执行） */
  isConcurrencySafe?: boolean;
  /** 是否破坏性操作（删除/覆盖/发送等不可逆操作） */
  isDestructive?: boolean;
  /** 用户新消息时的中断行为 */
  interruptBehavior?: InterruptBehavior;
  /** 结果最大字符数（超长自动截断） */
  maxResultSizeChars?: number;
  /** 是否启用 */
  isEnabled?: () => boolean;
  /** 权限级别（默认 auto） */
  permissionLevel?: PermissionLevel;
  /** 输入校验（可选，默认使用 inputSchema） */
  validateInput?: (input: unknown) => { valid: boolean; error?: string };
  /** 权限检查（可选，用于多租户审批） */
  checkPermissions?: (input: TInput, ctx: ToolContext) => Promise<{ allowed: boolean; reason?: string }>;
  /** 在验证和执行前预处理输入（Claude Code: backfillObservableInput） */
  backfillObservableInput?: (input: Record<string, unknown>) => void;
}

// ── 构建器 ─────────────────────────────────────────────────

export type BuiltTool<TInput, TOutput> = ToolDef<TInput, TOutput> & {
  isReadOnly: boolean;
  isEnabled: () => boolean;
  permissionLevel: PermissionLevel;
  isConcurrencySafe: boolean;
  isDestructive: boolean;
  interruptBehavior: InterruptBehavior;
  /** JSON Schema 形式（给 Provider 用） */
  jsonSchema: Record<string, unknown>;
};

const TOOL_DEFAULTS = {
  isReadOnly: false,
  isEnabled: () => true,
  permissionLevel: 'auto' as PermissionLevel,
  isConcurrencySafe: false,
  isDestructive: false,
  interruptBehavior: 'block' as InterruptBehavior,
  aliases: [] as string[],
};

/**
 * defineTool — 类比 Claude Code's buildTool pattern。
 * 传入 ToolDef，自动补充默认值并生成 JSON Schema。
 */
export function defineTool<TInput = unknown, TOutput = string>(
  def: ToolDef<TInput, TOutput>,
): BuiltTool<TInput, TOutput> {
  return {
    ...TOOL_DEFAULTS,
    ...def,
    aliases: def.aliases ?? [],
    jsonSchema: serializeZodSchema(def.inputSchema, def.description),
    isReadOnly: def.isReadOnly ?? false,
    isEnabled: def.isEnabled ?? (() => true),
    permissionLevel: def.permissionLevel ?? 'auto',
    isConcurrencySafe: def.isConcurrencySafe ?? false,
    isDestructive: def.isDestructive ?? false,
    interruptBehavior: def.interruptBehavior ?? 'block',
  } as BuiltTool<TInput, TOutput>;
}

/** 将 Zod Schema 转换为 Anthropic 兼容的 JSON Schema */
function serializeZodSchema(
  schema: z.ZodType<unknown>,
  description: string,
): Record<string, unknown> {
  try {
    const jsonSchema = zodToJson(schema, {
      target: 'openApi3',
      $refStrategy: 'none',
    });
    return {
      ...jsonSchema,
      description: schema.description || description,
    } as Record<string, unknown>;
  } catch {
    return {
      type: 'object',
      description: schema.description || description,
      properties: {},
      additionalProperties: true,
    };
  }
}

/**
 * 定义带手动 JSON Schema 覆盖的 Tool
 */
export function defineToolWithSchema<TInput = unknown, TOutput = string>(
  def: ToolDef<TInput, TOutput> & { jsonSchema: Record<string, unknown> },
): BuiltTool<TInput, TOutput> {
  return {
    ...TOOL_DEFAULTS,
    ...def,
    aliases: def.aliases ?? [],
    jsonSchema: def.jsonSchema,
    isReadOnly: def.isReadOnly ?? false,
    isEnabled: def.isEnabled ?? (() => true),
    permissionLevel: def.permissionLevel ?? 'auto',
    isConcurrencySafe: def.isConcurrencySafe ?? false,
    isDestructive: def.isDestructive ?? false,
    interruptBehavior: def.interruptBehavior ?? 'block',
  } as BuiltTool<TInput, TOutput>;
}

/**
 * Tool Orchestration — Claude Code 的 partitionToolCalls + runTools 模式
 *
 * 职责:
 * 1. partitionToolCalls: 按 isConcurrencySafe 将 tool_use 块分批
 * 2. runTools: 执行分批后的工具调用，支持并发
 * 3. 最大并发数: 10 (CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY)
 */
import type { AnyTool, ToolContext, ToolResult } from './Tool.js';

export interface ToolExecutionEvent {
  name: string;
  id: string;
  result: string;
  isError: boolean;
  extraMessages?: import('../types/index.js').Message[];
  newMessages?: import('../types/index.js').Message[];
}

interface Batch {
  isConcurrencySafe: boolean;
  calls: Array<{ name: string; input: Record<string, unknown>; id: string }>;
}

function getMaxConcurrency(): number {
  const env = process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY;
  return env ? parseInt(env, 10) : 10;
}

/** 按 isConcurrencySafe 分批（Claude Code partitionToolCalls） */
export function partitionToolCalls(
  calls: Array<{ name: string; input: Record<string, unknown>; id: string }>,
  tools: AnyTool[],
): Batch[] {
  const batches: Batch[] = [];
  let currentSafeBatch: Batch | null = null;

  for (const call of calls) {
    const tool = tools.find(t => t.name === call.name);
    const isSafe = tool?.isConcurrencySafe ?? false;

    if (isSafe) {
      if (!currentSafeBatch) {
        currentSafeBatch = { isConcurrencySafe: true, calls: [] };
        batches.push(currentSafeBatch);
      }
      currentSafeBatch.calls.push(call);
    } else {
      currentSafeBatch = null;
      batches.push({ isConcurrencySafe: false, calls: [call] });
    }
  }

  return batches;
}

/** 执行一批工具调用 */
export async function runTools(
  batches: Batch[],
  tools: AnyTool[],
  ctx: ToolContext,
  signal?: AbortSignal,
  onProgress?: (name: string) => void,
): Promise<ToolExecutionEvent[]> {
  const results: ToolExecutionEvent[] = [];

  for (const batch of batches) {
    if (signal?.aborted) break;

    if (batch.isConcurrencySafe) {
      // 并发执行
      const maxConc = getMaxConcurrency();
      const chunks: typeof batch.calls[] = [];
      for (let i = 0; i < batch.calls.length; i += maxConc) {
        chunks.push(batch.calls.slice(i, i + maxConc));
      }
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(call => executeSingleTool(call, tools, ctx, signal, onProgress)),
        );
        results.push(...chunkResults);
      }
    } else {
      // 串行执行
      for (const call of batch.calls) {
        const result = await executeSingleTool(call, tools, ctx, signal, onProgress);
        results.push(result);
        if (result.isError && signal?.aborted) break;
      }
    }
  }

  return results;
}

/** 执行单个工具（Claude Code runToolUse 精简版） */
async function executeSingleTool(
  call: { name: string; input: Record<string, unknown>; id: string },
  tools: AnyTool[],
  ctx: ToolContext,
  signal?: AbortSignal,
  onProgress?: (name: string) => void,
): Promise<ToolExecutionEvent> {
  const tool = tools.find(t => t.name === call.name);

  if (!tool) {
    return { name: call.name, id: call.id, result: `工具 "${call.name}" 不存在`, isError: true };
  }

  if (!tool.isEnabled()) {
    return { name: call.name, id: call.id, result: `工具 "${call.name}" 未启用`, isError: true };
  }

  if (signal?.aborted) {
    return { name: call.name, id: call.id, result: '执行已被中断', isError: true };
  }

  onProgress?.(call.name);

  try {
    // 输入校验
    if (tool.validateInput) {
      const validation = tool.validateInput(call.input);
      if (!validation.valid) {
        return { name: call.name, id: call.id, result: `输入校验失败: ${validation.error}`, isError: true };
      }
    }

    // 权限检查
    if (tool.checkPermissions) {
      const perm = await tool.checkPermissions(call.input, ctx);
      if (!perm.allowed) {
        return { name: call.name, id: call.id, result: `权限不足: ${perm.reason || '无权限'}`, isError: true };
      }
    }

    // 执行
    const result = await tool.call(call.input, { ...ctx, signal });

    // 结果截断
    let output = result.data;
    if (tool.maxResultSizeChars && output.length > tool.maxResultSizeChars) {
      output = output.slice(0, tool.maxResultSizeChars) + '\n...(截断)';
    }

    return {
      name: call.name,
      id: call.id,
      result: output,
      isError: result.isError ?? false,
      extraMessages: result.extraMessages,
      newMessages: result.newMessages,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: call.name, id: call.id, result: `工具异常: ${msg}`, isError: true };
  }
}

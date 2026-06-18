/**
 * Token Estimation — Claude Code 的 services/tokenEstimation.ts + utils/tokens.ts 移植
 *
 * 文件类型感知的 token 估算 + 消息级别计数。
 */
import type { Message } from '../types/index.js';

/** 文件扩展名 → bytes/token 比率 */
const FILE_TYPE_RATIOS: Record<string, number> = {
  '.ts': 4, '.tsx': 4, '.js': 4, '.jsx': 4, '.py': 4,
  '.rs': 4, '.go': 4, '.java': 4, '.c': 4, '.cpp': 4,
  '.md': 5, '.txt': 5, '.json': 6, '.yaml': 6, '.yml': 6,
  '.html': 5, '.css': 5, '.sql': 4,
};

/** 获取文件类型的 bytes/token */
export function bytesPerTokenForFileType(ext: string): number {
  return FILE_TYPE_RATIOS[ext.toLowerCase()] || 4;
}

/** 粗略 token 估算（字符/字节级别） */
export function roughTokenCountEstimation(text: string, bytesPerToken: number = 4): number {
  return Math.ceil(Buffer.byteLength(text, 'utf-8') / bytesPerToken);
}

/** 文件类型感知的 token 估算 */
export function roughTokenCountEstimationForFileType(content: string, fileExtension: string): number {
  return roughTokenCountEstimation(content, bytesPerTokenForFileType(fileExtension));
}

/** 单条消息的 token 估算 */
export function roughTokenCountEstimationForMessage(message: Message): number {
  if (typeof message.content === 'string') return roughTokenCountEstimation(message.content) + 4;
  let total = 0;
  for (const block of message.content) {
    if (block.type === 'text' && block.text) total += roughTokenCountEstimation(block.text) + 4;
    if (block.type === 'image') total += 800;
  }
  return total;
}

/** 多条消息的 token 估算 */
export function roughTokenCountEstimationForMessages(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + roughTokenCountEstimationForMessage(msg), 0);
}

/** 从使用信息中提取 token 计数 */
export function getTokenCountFromUsage(usage: { input_tokens?: number; output_tokens?: number; total?: number }): number {
  return usage.total ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
}

/** 从消息中获取最后的使用信息 */
export function getCurrentUsage(messages: Message[]): { input_tokens: number; output_tokens: number } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.metadata?.usage) {
      const u = m.metadata.usage as Record<string, number>;
      return { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0 };
    }
  }
  return null;
}

/**
 * compactConversation — Claude Code 的对话压缩功能
 *
 * 将旧的对话消息通过 LLM 总结为简短摘要，释放上下文窗口空间。
 * 对应 Claude Code 的 src/services/compact/compact.ts
 */
import type { Message } from '../../types/index.js';
import type { AIProvider } from '../../providers/types.js';

export interface CompactionResult {
  summaryMessages: Message[];
  messagesToKeep?: Message[];
  preCompactTokenCount: number;
  postCompactTokenCount: number;
}

/**
 * 压缩对话 — 将旧消息总结为摘要
 *
 * 策略（对应 Claude Code 的 compactConversation）:
 * 1. 保留最新 N 条消息不动
 * 2. 将旧消息发送给 LLM 做摘要
 * 3. 用摘要替换旧消息
 */
export async function compactConversation(
  messages: Message[],
  provider: AIProvider,
  keepCount: number = 10,
): Promise<CompactionResult> {
  if (messages.length <= keepCount) {
    return {
      summaryMessages: [],
      messagesToKeep: messages,
      preCompactTokenCount: countTokens(messages),
      postCompactTokenCount: countTokens(messages),
    };
  }

  const preCount = countTokens(messages);
  const toCompact = messages.slice(0, -keepCount);
  const toKeep = messages.slice(-keepCount);

  // 构建压缩提示（对应 Claude Code 的 streamCompactSummary）
  const conversationText = toCompact
    .map(m => {
      const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '系统';
      const content = typeof m.content === 'string' ? m.content : '[多媒体]';
      return `${role}: ${content.slice(0, 500)}`;
    })
    .join('\n');

  const summaryPrompt = `请对以下对话进行简要总结，提取关键信息和用户需求。用中文总结，不超过200字。\n\n${conversationText}`;

  try {
    // 使用 AI Provider 生成摘要（对应 Claude Code 的 runForkedAgent）
    const stream = provider.stream(
      [{ role: 'user', content: summaryPrompt }],
      [],
    );

    let summaryText = '';
    for await (const event of stream) {
      if (event.type === 'text') summaryText += event.delta;
    }

    const summaryMessage: Message = {
      role: 'system',
      content: `[对话摘要]\n${summaryText || '(对话内容已压缩)'}`,
    };

    const resultMessages = [summaryMessage, ...toKeep];
    const postCount = countTokens(resultMessages);

    return {
      summaryMessages: [summaryMessage],
      messagesToKeep: toKeep,
      preCompactTokenCount: preCount,
      postCompactTokenCount: postCount,
    };
  } catch {
    // 压缩失败，保留原消息
    return {
      summaryMessages: [],
      messagesToKeep: messages,
      preCompactTokenCount: preCount,
      postCompactTokenCount: preCount,
    };
  }
}

function countTokens(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    const text = typeof m.content === 'string' ? m.content : '';
    total += Math.ceil(text.length * 0.38) + 4;
  }
  return total;
}

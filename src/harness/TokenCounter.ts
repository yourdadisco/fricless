import type { Message } from '../types/index.js';

export class TokenCounter {
  /**
   * 估算文本的 Token 数量，对中文进行加权处理。
   *
   * - 中文字符（CJK 统一表意文字等）: ~1.5 tokens/char
   * - 英文及其他字符: ~0.25 tokens/char
   * - 混合文本自动检测并按比例估算
   */
  static estimate(text: string, _model: string = 'claude'): number {
    let chineseCount = 0;
    let otherCount = 0;

    for (const char of text) {
      // CJK Unified Ideographs, Extension A, and CJK Compatibility Ideographs
      if (/[一-鿿㐀-䶿豈-﫿]/.test(char)) {
        chineseCount++;
      } else {
        otherCount++;
      }
    }

    // Chinese chars: ~1.5 tokens per char, English/other: ~0.25 tokens per char
    const tokens = chineseCount * 1.5 + otherCount * 0.25;
    return Math.ceil(tokens);
  }

  static countMessages(messages: Message[], model: string = 'claude'): number {
    let total = 0;
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        total += this.estimate(msg.content, model);
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            total += this.estimate(block.text, model);
          }
          if (block.type === 'image') {
            total += 800; // Fixed image token overhead
          }
        }
      }
      // Overhead per message
      total += 4;
    }
    return total;
  }

  static truncateToBudget(messages: Message[], budget: number, model: string = 'claude'): Message[] {
    const result: Message[] = [];
    let used = 0;

    // Always include system messages (first messages)
    for (const msg of messages) {
      if (msg.role === 'system') {
        const tokens = this.estimate(typeof msg.content === 'string' ? msg.content : '', model);
        if (used + tokens <= budget) {
          result.push(msg);
          used += tokens + 4;
        }
      }
    }

    // Include user/assistant messages from most recent
    const nonSystem = messages.filter(m => m.role !== 'system');
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      const tokens = this.estimate(typeof msg.content === 'string' ? msg.content : '', model);
      if (used + tokens + 4 <= budget) {
        result.splice(result.length - (nonSystem.length - 1 - i), 0, msg);
        used += tokens + 4;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * tokenCountWithEstimation — Claude Code 的 tokenCountWithEstimation 移植
   *
   * 结合精确计数（如果有 usage 信息）和混合估算。
   * 对应 Claude Code 的 src/utils/tokens.ts
   */
  static tokenCountWithEstimation(messages: Message[], model: string = 'claude'): number {
    // 从最后一条有 usage 信息的 assistant 消息向后查
    let total = 0;
    let foundUsage = false;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.metadata?.usage) {
        const usage = msg.metadata.usage as { input_tokens?: number; output_tokens?: number };
        total = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
        foundUsage = true;
        break;
      }
    }

    if (foundUsage) {
      // 对 usage 之后的消息做估算（tool results、后续轮次）
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.metadata?.usage) break;
        const text = typeof msg.content === 'string' ? msg.content : '';
        total += this.estimate(text, model) + 4;
      }
      return total;
    }

    // 无 usage 信息，全部估算
    return this.countMessages(messages, model);
  }
}

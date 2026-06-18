import type { Message } from '../types/index.js';

export class TokenCounter {
  private static readonly RATIOS: Record<string, number> = {
    'claude': 0.38,
    'gpt-4': 0.35,
    'deepseek': 0.40,
    'qwen': 0.45,
  };

  static estimate(text: string, model: string = 'claude'): number {
    const ratio = this.RATIOS[model] ?? 0.38;
    return Math.ceil(text.length * ratio);
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
}

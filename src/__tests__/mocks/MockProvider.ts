import type { StreamResult, Message } from '../../types/index.js';
import type { AIProvider, ToolDescriptor } from '../../providers/types.js';

/**
 * MockProvider — 用于测试的可预测流事件序列生成器
 *
 * 支持预设响应序列：
 * - 纯文本响应
 * - 文本 + Tool Use + Tool 结果后文本
 * - 错误响应
 */
export type MockStreamSequence = Array<
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown>; id: string }
  | { type: 'error'; message: string }
>;

export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly vendor = 'mock';
  public sequences: MockStreamSequence[] = [];
  public callCount = 0;
  public lastMessages: Message[] = [];
  public lastTools: ToolDescriptor[] = [];

  constructor(sequences?: MockStreamSequence[]) {
    if (sequences) this.sequences = sequences;
  }

  setSequences(seq: MockStreamSequence[]): void {
    this.sequences = seq;
  }

  async *stream(messages: Message[], tools: ToolDescriptor[]): StreamResult {
    this.callCount++;
    this.lastMessages = messages;
    this.lastTools = tools;

    const seq = this.sequences[this.callCount - 1] ?? this.sequences[0];
    if (!seq) {
      yield { type: 'text', delta: 'Mock response' };
      yield { type: 'done', content: 'Mock response' };
      return;
    }

    let fullContent = '';
    for (const event of seq) {
      yield event;
      if (event.type === 'text') fullContent += event.delta;
      if (event.type === 'error') return;
    }
    yield { type: 'done', content: fullContent };
  }

  countTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length * 0.38) + 4;
    }
    return total;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getModelInfo() {
    return {
      name: 'mock-model',
      vendor: 'mock',
      maxContextTokens: 100000,
      maxOutputTokens: 4096,
      inputPricePer1k: 0,
      outputPricePer1k: 0,
      features: ['streaming' as const, 'tool_use' as const, 'vision' as const],
    };
  }
}

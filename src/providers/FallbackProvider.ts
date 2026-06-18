import type { StreamResult, Message } from '../types/index.js';
import type { AIProvider, ToolDescriptor, ModelInfo } from './types.js';

export class FallbackProvider implements AIProvider {
  readonly name = 'fallback';
  readonly vendor = 'fallback';
  private primary: AIProvider;

  constructor(private providers: AIProvider[]) {
    this.primary = providers[0];
  }

  async *stream(messages: Message[], tools: ToolDescriptor[]): StreamResult {
    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      try {
        if (i > 0) {
          yield { type: 'text', delta: `\n[回退到 ${this.providers[i].name}]\n` };
        }
        yield* this.providers[i].stream(messages, tools);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (i < this.providers.length - 1) continue;
      }
    }

    yield { type: 'error', message: `所有 Provider 均失败: ${lastError?.message}` };
  }

  countTokens(messages: Message[]): number { return this.primary.countTokens(messages); }
  healthCheck(): Promise<boolean> { return this.primary.healthCheck(); }
  getModelInfo(): ModelInfo { return this.primary.getModelInfo(); }
}

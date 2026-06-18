import OpenAI from 'openai';
import type { StreamResult, Message, ContentBlock } from '../types/index.js';
import type { AIProvider, ModelInfo, ProviderConfig, ToolDescriptor } from './types.js';

/**
 * OpenAIProvider — 兼容 OpenAI API 格式的所有提供商
 *
 * 支持: OpenAI / DeepSeek / Qwen / Kimi / MiniMax / OpenRouter / 等
 * 所有使用 /v1/chat/completions 接口的 API 均兼容。
 */
export class OpenAIProvider implements AIProvider {
  readonly name: string;
  readonly vendor: string;
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.name = config.vendor || 'openai';
    this.vendor = config.vendor || 'openai';
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      maxRetries: 0,
      timeout: 60000,
    });
  }

  async *stream(messages: Message[], tools: ToolDescriptor[]): StreamResult {
    // 将内部消息格式转为 OpenAI API 格式
    // 关键处理: tool 消息前必须有包含 tool_calls 的 assistant 消息
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    const nonSystem = messages.filter(m => m.role !== 'system');

    for (let i = 0; i < nonSystem.length; i++) {
      const m = nonSystem[i];

      if (m.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: m.toolCallId ?? '',
          content: typeof m.content === 'string' ? m.content : this.contentBlocksToText(m.content),
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
        continue;
      }

      // 检查后面是否跟着 tool 消息 → 需要添加 tool_calls 到 assistant 消息
      const nextMsg = nonSystem[i + 1];
      const hasFollowingTool = nextMsg?.role === 'tool' && nextMsg.toolCallId;

      if (m.role === 'assistant' && hasFollowingTool) {
        openaiMessages.push({
          role: 'assistant',
          content: this.messageContentToOpenAI(m),
          tool_calls: [{
            id: nextMsg.toolCallId!,
            type: 'function',
            function: {
              name: nextMsg.toolName || '',
              arguments: '{}',
            },
          }],
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
        continue;
      }

      openaiMessages.push({
        role: m.role as 'user' | 'assistant',
        content: this.messageContentToOpenAI(m),
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    }

    const systemMsg = messages.find(m => m.role === 'system');

    const apiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: sanitizeSchema(t.inputSchema),
      },
    }));

    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          ...(systemMsg ? [{ role: 'system' as const, content: this.messageContentToText(systemMsg.content) }] : []),
          ...openaiMessages,
        ],
        tools: apiTools.length > 0 ? apiTools : undefined,
        stream: true,
      });

      let accumulatedContent = '';
      let pendingToolCalls: Map<number, { name: string; args: string; id: string }> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // Text content
        if (delta.content) {
          accumulatedContent += delta.content;
          yield { type: 'text', delta: delta.content } as const;
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!pendingToolCalls.has(idx)) {
              pendingToolCalls.set(idx, {
                name: tc.function?.name || '',
                args: tc.function?.arguments || '',
                id: tc.id || `call_${idx}`,
              });
            } else {
              const existing = pendingToolCalls.get(idx)!;
              existing.args += tc.function?.arguments || '';
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.id) existing.id = tc.id;
            }
          }
        }

        // Finish reason
        if (chunk.choices?.[0]?.finish_reason) {
          const reason = chunk.choices[0].finish_reason;
          if (reason === 'tool_calls') {
            for (const [, tc] of pendingToolCalls) {
              try {
                const parsed = JSON.parse(tc.args);
                yield {
                  type: 'tool_use',
                  name: tc.name,
                  input: parsed as Record<string, unknown>,
                  id: tc.id,
                } as const;
              } catch {
                yield {
                  type: 'tool_use',
                  name: tc.name,
                  input: { raw: tc.args },
                  id: tc.id,
                } as const;
              }
            }
            pendingToolCalls.clear();
          }
          if (reason === 'stop') {
            yield { type: 'done', content: accumulatedContent } as const;
          }
        }
      }

      // If stream ended without finish_reason but we have tool calls
      if (pendingToolCalls.size > 0) {
        for (const [, tc] of pendingToolCalls) {
          yield { type: 'tool_use', name: tc.name, input: { raw: tc.args }, id: tc.id } as const;
        }
        pendingToolCalls.clear();
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      yield { type: 'error', message: msg } as const;
    }
  }

  private messageContentToOpenAI(msg: Message): string | Array<OpenAI.Chat.Completions.ChatCompletionContentPart> {
    if (typeof msg.content === 'string') return msg.content;
    return msg.content.map(block => {
      if (block.type === 'text') return { type: 'text', text: block.text || '' };
      if (block.type === 'image' && block.image) {
        return {
          type: 'image_url',
          image_url: { url: `data:${block.image.mediaType};base64,${block.image.base64}` },
        };
      }
      return { type: 'text', text: '[unsupported content]' };
    });
  }

  private contentBlocksToText(blocks: ContentBlock[]): string {
    return blocks.map(b => {
      if (b.type === 'text') return b.text || '';
      return '[media]';
    }).join(' ');
  }

  private messageContentToText(content: string | ContentBlock[]): string {
    return typeof content === 'string' ? content : this.contentBlocksToText(content);
  }

  countTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      const text = typeof msg.content === 'string' ? msg.content : '';
      total += Math.ceil(text.length * 0.35) + 4;
    }
    return total;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.config.model,
      vendor: this.vendor,
      maxContextTokens: 128000,
      features: ['streaming', 'tool_use'],
    };
  }
}

/**
 * 清洗 JSON Schema 以兼容 OpenAI strict mode:
 *
 * Zod 生成的 Schema 包含一些 OpenAI strict mode 不支持的字段:
 * - default → 删除（OpenAI 不支持）
 * - description → 删除（已在 function 级别定义）
 * - additionalProperties: true → 删除（strict 模式禁止）
 * - exclusiveMinimum / exclusiveMaximum 为 boolean → 删除（strict 模式要求 number）
 */
function sanitizeSchema(schema: unknown): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) return { type: 'object' };
  const result = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;

  // 删除顶级有问题的字段
  delete result.default;
  delete result.description;
  if (result.additionalProperties === true) delete result.additionalProperties;

  // 递归清洗每个属性
  if (result.properties && typeof result.properties === 'object') {
    for (const val of Object.values(result.properties as Record<string, unknown>)) {
      if (typeof val === 'object' && val !== null) {
        const prop = val as Record<string, unknown>;
        delete prop.default;
        delete prop.description;
        if (prop.additionalProperties === true) delete prop.additionalProperties;
        // Zod 对 positive() 生成 exclusiveMinimum: true，OpenAI 只接受 number
        if (prop.exclusiveMinimum === true) delete prop.exclusiveMinimum;
        if (prop.exclusiveMaximum === true) delete prop.exclusiveMaximum;
      }
    }
  }

  return result;
}

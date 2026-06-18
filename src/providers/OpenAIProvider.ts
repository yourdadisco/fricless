import OpenAI from 'openai';
import type { StreamResult, Message, ContentBlock } from '../types/index.js';
import type { AIProvider, ModelInfo, ProviderConfig, ToolDescriptor } from './types.js';

/**
 * 对 DeepSeek 使用原生 fetch 发送请求（绕过 OpenAI SDK），
 * 确保 enable_web_search: true 被正确发送到 API 顶层。
 */
async function* deepseekStream(config: ProviderConfig, body: Record<string, unknown>): StreamResult {
  try {
    const res = await fetch(`${(config.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        ...body,
        enable_web_search: true,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'no body');
      throw new Error(`${res.status} ${errText.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;
          const finish = json.choices?.[0]?.finish_reason;

          if (delta?.content) {
            accumulated += delta.content;
            yield { type: 'text' as const, delta: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              yield {
                type: 'tool_use' as const,
                name: tc.function?.name || '',
                input: (() => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return { raw: tc.function?.arguments }; } })(),
                id: tc.id || `call_${tc.index}`,
              };
            }
          }

          if (finish === 'stop') {
            yield { type: 'done' as const, content: accumulated };
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } catch (err: any) {
    yield { type: 'error' as const, message: err.message || String(err) };
  }
}

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

      // tool 消息：由对应的 assistant 消息处理，跳过
      if (m.role === 'tool') continue;

      // user 消息：直接添加
      if (m.role === 'user') {
        openaiMessages.push({
          role: 'user',
          content: this.messageContentToOpenAI(m),
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
        continue;
      }

      // assistant 消息：检查后面是否跟着 tool 消息
      if (m.role === 'assistant') {
        // 收集所有连续的工具调用
        const toolCallInfos: Array<{ id: string; name: string }> = [];
        let j = i + 1;
        while (j < nonSystem.length && nonSystem[j].role === 'tool') {
          if (nonSystem[j].toolCallId && nonSystem[j].toolName) {
            toolCallInfos.push({ id: nonSystem[j].toolCallId!, name: nonSystem[j].toolName! });
          }
          j++;
        }

        if (toolCallInfos.length > 0) {
          // 有 tool_calls：添加 assistant 消息 + 所有 tool 结果
          openaiMessages.push({
            role: 'assistant',
            content: this.messageContentToOpenAI(m),
            tool_calls: toolCallInfos.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: '{}' },
            })),
          } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

          // 添加 tool 结果消息
          for (let k = i + 1; k < j; k++) {
            const toolMsg = nonSystem[k];
            openaiMessages.push({
              role: 'tool',
              tool_call_id: toolMsg.toolCallId ?? '',
              content: typeof toolMsg.content === 'string' ? toolMsg.content : this.contentBlocksToText(toolMsg.content),
            } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
          }
          // 跳过已处理的 tool 消息
          i = j - 1;
          continue;
        }

        // 普通 assistant 消息（无 tool_calls）
        openaiMessages.push({
          role: 'assistant',
          content: this.messageContentToOpenAI(m),
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
        continue;
      }
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
      if (this.vendor === 'deepseek') {
        // DeepSeek：使用原生 fetch 确保 enable_web_search 正确传递
        // DeepSeek 原生联网搜索，不需要传 tools
        const body: Record<string, unknown> = {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          messages: [
            ...(systemMsg ? [{ role: 'system', content: this.messageContentToText(systemMsg.content) }] : []),
            ...openaiMessages,
          ],
        };
        yield* deepseekStream(this.config, body);
        return;
      }

      const streamParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          ...(systemMsg ? [{ role: 'system' as const, content: this.messageContentToText(systemMsg.content) }] : []),
          ...openaiMessages,
        ],
        tools: apiTools.length > 0 ? apiTools : undefined,
        stream: true,
      };
      const stream = await this.client.chat.completions.create(streamParams);

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
        // 保留 description：LLM 需要参数说明才能正确填写
        if (prop.additionalProperties === true) delete prop.additionalProperties;
        // Zod 对 positive() 生成 exclusiveMinimum: true，OpenAI 只接受 number
        if (prop.exclusiveMinimum === true) delete prop.exclusiveMinimum;
        if (prop.exclusiveMaximum === true) delete prop.exclusiveMaximum;
      }
    }
  }

  return result;
}

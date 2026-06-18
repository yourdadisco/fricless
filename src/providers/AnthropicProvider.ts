import Anthropic from '@anthropic-ai/sdk';
import type { StreamResult, Message, ContentBlock } from '../types/index.js';
import type { AIProvider, ModelInfo, ProviderConfig, ToolDescriptor } from './types.js';

/**
 * Anthropic (Claude) API Provider
 *
 * 将 Claude API 的流式响应映射为统一的 StreamResult。
 * 支持 Text delta、Tool Use、ContentBlock（图像）等多种事件类型。
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly vendor = 'anthropic';
  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async *stream(messages: Message[], tools: ToolDescriptor[]): StreamResult {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages: Anthropic.MessageParam[] = nonSystemMessages.map(m => {
      if (m.role === 'tool') {
        // Tool result messages
        const toolResultContent: Anthropic.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: m.toolCallId ?? '',
          content: typeof m.content === 'string' ? m.content : this.contentBlocksToText(m.content),
        };
        return { role: 'user', content: [toolResultContent] };
      }

      // user / assistant messages
      return {
        role: m.role as 'user' | 'assistant',
        content: this.messageContentToAnthropic(m),
      };
    });

    const apiTools: Anthropic.Tool[] = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    try {
      const stream = await this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemMsg ? this.messageContentToText(systemMsg.content) : undefined,
        messages: anthropicMessages,
        tools: apiTools.length > 0 ? apiTools : undefined,
      });

      let accumulatedContent = '';

      for await (const event of stream) {
        switch (event.type) {
          case 'content_block_delta': {
            const delta = event.delta;
            if (delta.type === 'text_delta') {
              accumulatedContent += delta.text;
              yield { type: 'text', delta: delta.text } as const;
            }
            break;
          }
          case 'content_block_start': {
            const block = event.content_block;
            if (block.type === 'tool_use') {
              yield {
                type: 'tool_use',
                name: block.name,
                input: block.input as Record<string, unknown>,
                id: block.id,
              } as const;
            }
            break;
          }
          case 'message_delta': {
            if (event.delta.stop_reason === 'end_turn' || event.delta.stop_reason === 'stop_sequence') {
              yield { type: 'done', content: accumulatedContent } as const;
            }
            break;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: 'error', message } as const;
    }
  }

  /** 将 Message.content 转为 Anthropic content 格式 */
  private messageContentToAnthropic(msg: Message): string | Anthropic.Messages.MessageParam['content'] {
    if (typeof msg.content === 'string') {
      return msg.content as Anthropic.Messages.MessageParam['content'];
    }
    return msg.content.map(block => this.contentBlockToAnthropic(block)) as Anthropic.Messages.MessageParam['content'];
  }

  /** 将单个 ContentBlock 转为 Anthropic 格式 */
  private contentBlockToAnthropic(block: ContentBlock): Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam {
    switch (block.type) {
      case 'text':
        return { type: 'text' as const, text: block.text ?? '' };
      case 'image':
        if (block.image) {
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: block.image.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
              data: block.image.base64,
            },
          };
        }
        return { type: 'text' as const, text: '[图片]' };
      case 'file':
        return { type: 'text' as const, text: `[文件: ${block.file?.name ?? '未知'}]` };
    }
  }

  /** 将 ContentBlock[] 转为纯文本 */
  private contentBlocksToText(content: ContentBlock[]): string {
    return content.map(b => {
      if (b.type === 'text') return b.text ?? '';
      if (b.type === 'image') return '[图片]';
      if (b.type === 'file') return `[文件: ${b.file?.name ?? '未知'}]`;
      return '';
    }).join('\n');
  }

  countTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      const text = typeof msg.content === 'string' ? msg.content : this.contentBlocksToText(msg.content);
      // 粗略估算: 中文约 1.5 字符/token，英文约 0.25 词/token
      total += Math.ceil(text.length * 0.38) + 4;
    }
    return total;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 通过轻量请求验证 API 可用性
      await this.client.messages.stream({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user' as const, content: 'ping' }],
      }).finalMessage();
      return true;
    } catch {
      return false;
    }
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.config.model,
      vendor: 'anthropic',
      maxContextTokens: 200000,
      features: ['streaming', 'tool_use', 'vision'],
    };
  }

  /** 将 content（string | ContentBlock[]）转为纯文本 */
  private messageContentToText(content: string | ContentBlock[]): string {
    return typeof content === 'string' ? content : this.contentBlocksToText(content);
  }
}

import crypto from 'node:crypto';
import pino from 'pino';
import type { InboundMessage } from '../channels/types.js';
import type { AIProvider } from '../providers/types.js';
import type { Message } from '../types/index.js';
import { Harness } from '../harness/Harness.js';
import type { AnyTool } from '../harness/Tool.js';
import type { CommandDef } from '../harness/Command.js';
import type { Renderer } from '../render/RenderLayer.js';
import { Session } from '../session/Session.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'coordinator' });

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: AnyTool[];
  provider: AIProvider;
  maxToolRoundtrips?: number;
}

export class SubAgent {
  readonly harness: Harness;

  constructor(
    readonly name: string,
    readonly description: string,
    session: Session,
    provider: AIProvider,
    tools: AnyTool[],
    renderer: Renderer,
    chatId: string,
    systemPrompt?: string,
  ) {
    this.harness = new Harness({
      session,
      provider,
      tools,
      commandDefs: [],
      renderer,
      chatId,
      options: { systemPrompt },
    });
  }
}

export class Coordinator {
  private agents: SubAgent[] = [];
  private primaryAgent: SubAgent;
  private primaryProvider: AIProvider;
  private primaryTools: AnyTool[];
  private primarySystemPrompt: string;
  private rendererFactory: (chatId: string) => Renderer;

  constructor(params: {
    primaryConfig: AgentConfig;
    primarySession: Session;
    rendererFactory: (chatId: string) => Renderer;
    chatId: string;
  }) {
    this.primaryProvider = params.primaryConfig.provider;
    this.primaryTools = params.primaryConfig.tools;
    this.primarySystemPrompt = params.primaryConfig.systemPrompt ?? '';
    this.rendererFactory = params.rendererFactory;

    this.primaryAgent = new SubAgent(
      params.primaryConfig.name,
      params.primaryConfig.description,
      params.primarySession,
      params.primaryConfig.provider,
      params.primaryConfig.tools,
      params.rendererFactory(params.chatId),
      params.chatId,
      params.primaryConfig.systemPrompt,
    );
  }

  registerAgent(config: AgentConfig, session: Session): SubAgent {
    const agent = new SubAgent(
      config.name,
      config.description,
      session,
      config.provider,
      config.tools,
      this.rendererFactory(session.chatId || session.id),
      session.chatId || session.id,
      config.systemPrompt,
    );
    this.agents.push(agent);
    return agent;
  }

  async handleUserMessage(text: string): Promise<void> {
    logger.info({ text }, 'Coordinator handling message');
    await this.primaryAgent.harness.handleUserMessage(text);
  }

  getAgents(): SubAgent[] {
    return [this.primaryAgent, ...this.agents];
  }

  // ── Phase D: AI-based routing ─────────────────────────────────

  /**
   * classifyIntent — 使用 AI 对用户意图进行分类
   *
   * 返回分类标签: 'question' | 'command' | 'complex_task' | 'small_talk' | 'system_request' | 'unknown'
   */
  async classifyIntent(text: string): Promise<string> {
    const prompt = [
      'You are an intent classifier. Classify the following user message into exactly one category:',
      '"question" (a factual question), "command" (a direct instruction/order),',
      '"complex_task" (multi-step or analytical task), "small_talk" (greeting/chat),',
      '"system_request" (request about the system itself).',
      'Respond with ONLY the category name in lowercase, nothing else.',
      '',
      `User message: ${text}`,
      '',
      'Category:',
    ].join('\n');

    try {
      const result = await this.askProvider(prompt);
      const valid = ['question', 'command', 'complex_task', 'small_talk', 'system_request'];
      const matched = valid.find(c => result.toLowerCase().includes(c));
      return matched ?? 'unknown';
    } catch (err) {
      logger.warn({ err }, 'Intent classification failed, falling back to unknown');
      return 'unknown';
    }
  }

  /**
   * spawnSubAgent — 为复杂任务自动创建子 Agent
   *
   * 创建一个独立的 SubAgent，继承主 Agent 的 Provider 和 Tool 注册表。
   */
  async spawnSubAgent(task: string): Promise<SubAgent> {
    const agentName = `agent-${(this.agents.length + 1).toString(16)}`;
    const agentSession = new Session({
      id: crypto.randomUUID(),
      userId: `agent:${agentName}`,
      systemPrompt: `You are a specialized sub-agent focused on the following task:\n\n${task}\n\nComplete this task using the tools available to you. Report your findings when done.`,
    });

    const agent = new SubAgent(
      agentName,
      `Sub-agent for: ${task.substring(0, 80)}`,
      agentSession,
      this.primaryProvider,
      this.primaryTools,
      this.rendererFactory(agentSession.id),
      agentSession.id,
      `You are a specialized sub-agent. Task: ${task}`,
    );
    this.agents.push(agent);
    logger.info({ agentName, task: task.substring(0, 100) }, 'Spawned sub-agent');
    return agent;
  }

  /**
   * synthesize — 综合多个子 Agent 的结果
   *
   * 将多个来源的结果合并为一个连贯的最终答案。
   */
  async synthesize(results: string[]): Promise<string> {
    if (results.length === 0) return '没有可供综合的结果。';
    if (results.length === 1) return results[0];

    const prompt = [
      'You are a synthesis assistant. Combine the following results from multiple sources',
      'into one coherent, well-structured answer. Integrate the information - do not simply list them.',
      'Fill gaps between results and resolve contradictions if any.',
      '',
      ...results.map((r, i) => `--- Source ${i + 1} ---\n${r}`),
      '',
      'Synthesized response:',
    ].join('\n');

    try {
      return await this.askProvider(prompt);
    } catch (err) {
      logger.error({ err }, 'Synthesis failed, returning raw concatenation');
      return results.map((r, i) => `[Result ${i + 1}]\n${r}`).join('\n\n');
    }
  }

  // ── 私有辅助方法 ───────────────────────────────────────────

  /** 向 Provider 发送纯文本提示并获取文本响应 */
  private async askProvider(prompt: string): Promise<string> {
    const messages: Message[] = [{ role: 'user', content: prompt }];
    const stream = this.primaryProvider.stream(messages, []);
    let content = '';
    for await (const event of stream) {
      if (event.type === 'text') {
        content += event.delta;
      }
    }
    return content.trim();
  }
}

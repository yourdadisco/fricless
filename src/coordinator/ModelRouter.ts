import type { Message } from '../types/index.js';
import type { AIProvider, ModelInfo } from '../providers/types.js';

/**
 * 路由规则 — 将消息匹配到目标 Provider
 */
export interface RoutingRule {
  /** 规则名称（日志/调试用） */
  name: string;
  /** 匹配条件 */
  match: (messages: Message[]) => boolean;
  /** 匹配时使用的 Provider */
  provider: AIProvider;
}

/**
 * ModelRouter — 消息路由到合适的模型 Provider
 *
 * 支持两种路由策略:
 * 1. 关键词规则: 根据消息内容中的关键词匹配合适的模型
 * 2. Token 预算: 小任务（Token 少）使用较便宜的模型
 */
export class ModelRouter {
  private rules: RoutingRule[] = [];
  private defaultProvider: AIProvider;
  private tokenCounter: (messages: Message[]) => number;

  constructor(options: {
    defaultProvider: AIProvider;
    tokenCounter?: (messages: Message[]) => number;
  }) {
    this.defaultProvider = options.defaultProvider;
    this.tokenCounter = options.tokenCounter ?? ((msgs) => {
      return msgs.reduce((sum, m) => {
        const text = typeof m.content === 'string' ? m.content : '';
        return sum + Math.ceil(text.length * 0.38) + 4;
      }, 0);
    });
  }

  /**
   * 注册一条路由规则
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
  }

  /**
   * 注册一组路由规则
   */
  addRules(rules: RoutingRule[]): void {
    this.rules.push(...rules);
  }

  /**
   * 根据消息内容和已注册规则选择 Provider
   */
  route(messages: Message[]): AIProvider {
    // 1. 先按关键词规则匹配
    for (const rule of this.rules) {
      if (rule.match(messages)) {
        return rule.provider;
      }
    }

    // 2. 按 Token 预算路由
    const totalTokens = this.tokenCounter(messages);
    return this.routeByTokenBudget(totalTokens);
  }

  /**
   * 创建关键词匹配规则
   */
  static keywordRule(
    name: string,
    keywords: string[],
    provider: AIProvider,
  ): RoutingRule {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    return {
      name,
      match: (messages) => {
        const text = messages
          .map(m => (typeof m.content === 'string' ? m.content : ''))
          .join(' ')
          .toLowerCase();
        return lowerKeywords.some(kw => text.includes(kw));
      },
      provider,
    };
  }

  /**
   * 创建 Token 预算匹配规则：当消息 Token 数低于阈值时路由
   */
  static tokenBudgetRule(
    name: string,
    maxTokens: number,
    provider: AIProvider,
    tokenCounter?: (messages: Message[]) => number,
  ): RoutingRule {
    const counter = tokenCounter ?? ((msgs) => {
      return msgs.reduce((sum, m) => {
        const text = typeof m.content === 'string' ? m.content : '';
        return sum + Math.ceil(text.length * 0.38) + 4;
      }, 0);
    });

    return {
      name,
      match: (messages) => counter(messages) <= maxTokens,
      provider,
    };
  }

  /** 重置所有规则 */
  clearRules(): void {
    this.rules = [];
  }

  /** 获取默认 Provider */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider;
  }

  /** 设置默认 Provider */
  setDefaultProvider(provider: AIProvider): void {
    this.defaultProvider = provider;
  }

  /** 基于 Token 预算的路由实现 */
  private routeByTokenBudget(_totalTokens: number): AIProvider {
    // 简单实现：小任务（低于 2000 tokens）保持默认
    // 大任务也使用默认 — 子类可覆盖此逻辑
    return this.defaultProvider;
  }
}

import type { AIProvider } from '../providers/types.js';
import type { Message } from '../types/index.js';
import type { MemoryStore, MemoryEntry } from './MemoryStore.js';

// Patterns for extracting key information from messages
const PATTERNS: { regex: RegExp; category: MemoryEntry['category']; tag: string }[] = [
  // Preferences: "我喜欢", "我讨厌", "我更喜欢", "I like", "I love", "my favorite"
  { regex: /(?:我喜欢|我讨厌|我更喜欢|I\s+(?:like|love|hate|prefer|enjoy)|my\s+favo?u?rite|我最喜欢|我最爱)/i, category: 'preference', tag: 'preference' },
  // Facts: "我是", "I am", "我叫", "my name is", "I work"
  { regex: /(?:我是|我叫|I'?m\s+|my\s+name\s+is|I\s+work|I\s+live|I\s+study|I\s+am)/i, category: 'fact', tag: 'personal' },
  // Dates/times: 生日, born on, on [date], at [time]
  { regex: /(?:生日|born\s+on|出生于|on\s+\d{1,2}[/-]\d{1,2}|at\s+\d{1,2}:\d{2})/i, category: 'event', tag: 'date' },
  // Important events: "remember", "今天", "yesterday", "last week"
  { regex: /(?:remember|记得|昨天|今天|明天|上周|下周|last\s+\w+|next\s+\w+|计划|打算|will\s+be)/i, category: 'event', tag: 'event' },
  // Summaries: "关键", "总结", "summary", "to sum up", "总的来说"
  { regex: /(?:关键|总结|summary|to\s+sum\s+up|总的来说|简而言之|in\s+short)/i, category: 'summary', tag: 'summary' },
];

/**
 * Extracts memories from conversation messages using pattern matching
 * and optionally AI-assisted extraction.
 */
export class MemoryExtractor {
  constructor(
    private store: MemoryStore,
    private provider?: AIProvider,
  ) {}

  /**
   * Extract memories from a list of messages using pattern matching.
   * Returns the number of memories saved.
   */
  async extractFromMessages(
    messages: Message[],
    sessionId: string,
    userId: string,
  ): Promise<number> {
    let saved = 0;

    for (const msg of messages) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(c => c.text ?? '').join('\n');

      if (!content.trim()) continue;

      const extractions = this.extractWithPatterns(content, sessionId, userId);
      for (const entry of extractions) {
        await this.store.save(entry);
        saved++;
      }
    }

    return saved;
  }

  /**
   * Use the AI provider to extract structured memories from a conversation.
   * Falls back to pattern matching if no provider is available.
   */
  async extractWithAI(
    conversation: string,
    sessionId: string,
    userId: string,
  ): Promise<number> {
    if (!this.provider) {
      // Fallback to pattern-based extraction
      return this.extractFromMessages(
        [{ role: 'user', content: conversation }],
        sessionId,
        userId,
      );
    }

    const prompt: Message[] = [
      {
        role: 'system',
        content: `You are a memory extraction assistant. Extract key facts, preferences, events, and summaries from the conversation below.

For each memory, output one line in this format:
CATEGORY|content|tag1,tag2,...

Categories: fact, preference, summary, event
Confidence is implicit — we'll assign 0.7.

Example:
fact|The user's name is Alice.|personal,name
preference|Alice prefers dark mode.|preference,theme
event|Alice has a meeting tomorrow at 2pm.|event,meeting

If nothing worth remembering is found, output nothing.`,
      },
      {
        role: 'user',
        content: conversation,
      },
    ];

    try {
      const result: string[] = [];
      const stream = this.provider.stream(prompt, []);
      for await (const event of stream) {
        if (event.type === 'text') {
          result.push(event.delta);
        }
      }

      const output = result.join('');
      let saved = 0;

      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parts = trimmed.split('|');
        if (parts.length < 2) continue;

        const category = parts[0].trim().toLowerCase() as MemoryEntry['category'];
        if (!['fact', 'preference', 'summary', 'event'].includes(category)) continue;

        const content = parts[1].trim();
        const tags = parts[2]?.trim().split(',').filter(Boolean) ?? [];

        await this.store.save({
          sessionId,
          userId,
          content,
          category,
          confidence: 0.7,
          tags,
        });
        saved++;
      }

      return saved;
    } catch {
      // Fallback to pattern matching on AI failure
      return this.extractFromMessages(
        [{ role: 'user', content: conversation }],
        sessionId,
        userId,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Extract memories by matching predefined patterns against a piece of text.
   */
  private extractWithPatterns(
    text: string,
    sessionId: string,
    userId: string,
  ): Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>[] {
    const results: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>[] = [];
    const seen = new Set<string>();

    for (const pattern of PATTERNS) {
      const matches = text.match(pattern.regex);
      if (!matches) continue;

      // Extract a window of ~100 chars around the match for context
      const matchIndex = matches.index ?? 0;
      const start = Math.max(0, matchIndex - 30);
      const end = Math.min(text.length, matchIndex + matches[0].length + 70);
      const snippet = text.slice(start, end).trim();

      // Deduplicate by snippet
      const key = `${pattern.category}:${snippet}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        sessionId,
        userId,
        content: snippet,
        category: pattern.category,
        confidence: 0.5,
        tags: [pattern.tag, pattern.category],
      });
    }

    return results;
  }
}

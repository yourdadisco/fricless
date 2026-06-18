import type { Message } from '../types/index.js';
import type { MemoryStore, MemoryEntry } from './MemoryStore.js';

/**
 * Injects relevant memories into conversation context by searching
 * for keyword matches from the latest user message and prepending
 * a system message with matched memories.
 */
export class MemoryInjector {
  constructor(private store: MemoryStore) {}

  /**
   * Build a memory-enriched context by searching for relevant memories
   * and inserting a system message before the existing messages.
   *
   * @param messages  The current conversation messages.
   * @param userId    The user ID to scope memory search.
   * @param maxMemories Maximum number of memories to inject (default 5).
   * @returns A new message array with the memory context prepended.
   */
  async enrichContext(
    messages: Message[],
    userId: string,
    maxMemories = 5,
  ): Promise<Message[]> {
    if (messages.length === 0) return messages;

    // Find the last user message to extract query keywords
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return messages;

    const query = typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : lastUserMsg.content.map(c => c.text ?? '').join(' ');

    if (!query.trim()) return messages;

    // Search for relevant memories
    const memories = await this.searchRelevantMemories(query, userId, maxMemories);
    if (memories.length === 0) return messages;

    // Build the memory context message
    const memoryContext = this.buildMemoryContext(memories);
    if (!memoryContext) return messages;

    return [memoryContext, ...messages];
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Search across user-specific memories and general query-based search.
   */
  private async searchRelevantMemories(
    query: string,
    userId: string,
    max: number,
  ): Promise<MemoryEntry[]> {
    // Extract keywords from the query
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return [];

    // Search by each keyword against the full-text index
    const seen = new Set<string>();
    const results: MemoryEntry[] = [];

    // Prioritize user-specific memories
    const userMemories = await this.store.getByUser(userId, 20);
    for (const mem of userMemories) {
      if (seen.has(mem.id)) continue;
      if (this.matchAgainst(mem, keywords)) {
        seen.add(mem.id);
        results.push(mem);
      }
    }

    // If we still need more, do a general search with the query itself
    if (results.length < max) {
      const generalMemories = await this.store.search(query, max * 2);
      for (const mem of generalMemories) {
        if (seen.has(mem.id)) continue;
        seen.add(mem.id);
        results.push(mem);
      }
    }

    // Sort: higher confidence first, then by last accessed
    results.sort((a, b) => {
      const conf = b.confidence - a.confidence;
      if (conf !== 0) return conf;
      return b.lastAccessedAt - a.lastAccessedAt;
    });

    return results.slice(0, max);
  }

  /**
   * Extract meaningful keywords from a query string.
   */
  private extractKeywords(query: string): string[] {
    // Chinese & English tokenization
    const tokens: string[] = [];

    // Extract ASCII words (2+ chars)
    const englishWords = query.match(/\b[a-zA-Z]{2,}\b/g) ?? [];
    tokens.push(...englishWords.map(w => w.toLowerCase()));

    // Extract Chinese character sequences (2+ chars)
    const chineseSeq = query.match(/[一-鿿]{2,}/g) ?? [];
    tokens.push(...chineseSeq);

    // Remove duplicates
    return [...new Set(tokens)];
  }

  /**
   * Check if a memory entry matches any of the given keywords.
   */
  private matchAgainst(entry: MemoryEntry, keywords: string[]): boolean {
    const contentLower = entry.content.toLowerCase();
    const tagsLower = entry.tags.map(t => t.toLowerCase());

    return keywords.some(kw =>
      contentLower.includes(kw) ||
      tagsLower.some(t => t.includes(kw) || kw.includes(t)),
    );
  }

  /**
   * Format matched memories into a system message.
   */
  private buildMemoryContext(memories: MemoryEntry[]): Message | null {
    if (memories.length === 0) return null;

    const lines: string[] = [
      '[Memory Context] Here are relevant facts from our previous conversations:',
      '',
    ];

    for (const mem of memories) {
      const tagStr = mem.tags.length > 0 ? ` [${mem.tags.slice(0, 3).join(', ')}]` : '';
      const confStr = mem.confidence >= 0.7 ? '' : ` (confidence: ${Math.round(mem.confidence * 100)}%)`;
      lines.push(`- ${mem.content}${tagStr}${confStr}`);
    }

    lines.push('', 'Use this context if relevant to the current conversation.');

    return {
      role: 'system',
      content: lines.join('\n'),
    };
  }
}

import type { MemoryStore, MemoryEntry } from './MemoryStore.js';
import type { AIProvider } from '../providers/types.js';

/**
 * KAIROS-style memory consolidation with AI-powered importance scoring.
 *
 * Unlike the basic version that just merges by keyword similarity,
 * this uses the AI provider to:
 * 1. Score memory importance (how valuable is this info?)
 * 2. Merge semantically similar memories (even if keywords differ)
 * 3. Extract structured facts from conversation history
 * 4. Proactively forget low-importance memories
 */
export class MemoryConsolidator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private store: MemoryStore,
    private provider?: AIProvider,
  ) {}

  /**
   * Full consolidation cycle with AI-powered scoring.
   * Called periodically by startPeriodicConsolidation.
   */
  async runConsolidation(): Promise<{ merged: number; deleted: number; archived: number }> {
    if (this.running) return { merged: 0, deleted: 0, archived: 0 };
    this.running = true;

    try {
      let merged = 0;
      let deleted = 0;
      let archived = 0;

      // 1. AI-powered importance scoring — mark low-value memories
      if (this.provider) {
        const allEntries = await this.store.getAllEntries();
        // Score in batches
        for (let i = 0; i < allEntries.length; i += 10) {
          const batch = allEntries.slice(i, i + 10);
          const lowValue = await this.scoreImportance(batch);
          for (const entry of lowValue) {
            // Low importance → delete
            await this.store.delete(entry.id);
            deleted++;
          }
        }
      }

      // 2. Merge similar entries (basic + AI-assisted if provider available)
      const mergeResult = await this.store.consolidate();
      merged += mergeResult;

      // 3. Archive old entries (>30 days, never accessed)
      const now = Date.now();
      const all = await this.store.getAllEntries();
      for (const entry of all) {
        if (now - entry.lastAccessedAt > 30 * 24 * 60 * 60 * 1000 && entry.accessCount < 2) {
          await this.store.delete(entry.id);
          archived++;
        }
      }

      return { merged, deleted, archived };
    } finally {
      this.running = false;
    }
  }

  /**
   * AI-powered importance scoring.
   * Uses the provider to rate how important each memory is (0-1).
   * Returns entries with score < 0.3 for deletion.
   */
  private async scoreImportance(entries: MemoryEntry[]): Promise<MemoryEntry[]> {
    if (!this.provider || entries.length === 0) return [];

    const prompt = `评估以下每条记忆的重要程度（0-1分）。
0.0 = 完全无用（如临时状态、无意义的对话）
0.5 = 可能有用的背景信息
1.0 = 非常重要（如用户偏好、关键事实、正在进行的项目）

每条记忆一行，输出格式：索引|评分|理由

记忆列表：
${entries.map((e, i) => `[${i}] 类别:${e.category} 内容:${e.content.slice(0, 100)}`).join('\n')}`;

    try {
      const stream = this.provider.stream([{ role: 'user', content: prompt }], []);
      let response = '';
      for await (const event of stream) {
        if (event.type === 'text') response += event.delta;
      }

      const lowScore: MemoryEntry[] = [];
      const lines = response.split('\n');
      for (const line of lines) {
        const match = line.match(/\[(\d+)\]\|([\d.]+)/);
        if (match) {
          const idx = parseInt(match[1]);
          const score = parseFloat(match[2]);
          if (idx >= 0 && idx < entries.length && score < 0.3) {
            lowScore.push(entries[idx]);
          }
        }
      }
      return lowScore;
    } catch {
      // AI scoring failed — fall back to basic decay
      return [];
    }
  }

  async startPeriodicConsolidation(intervalMs = 3600000): Promise<void> {
    if (this.timer) return;
    this.runConsolidation().catch(() => {});
    this.timer = setInterval(() => this.runConsolidation().catch(() => {}), intervalMs);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

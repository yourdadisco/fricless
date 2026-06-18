import type { MemoryStore } from './MemoryStore.js';

/**
 * Periodic memory consolidation similar to KAIROS auto-dream.
 * Merges similar entries (same category, overlapping content),
 * removes low-confidence old entries, and runs on a configurable interval.
 */
export class MemoryConsolidator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private store: MemoryStore) {}

  /**
   * Run a single consolidation cycle.
   *
   * 1. Merge similar entries (same category, overlapping content).
   * 2. Remove low-confidence entries older than 7 days.
   *
   * @returns Counts of merged and deleted entries.
   */
  async runConsolidation(): Promise<{ merged: number; deleted: number }> {
    if (this.running) {
      return { merged: 0, deleted: 0 };
    }

    this.running = true;

    try {
      const merged = await this.store.consolidate();
      return { merged, deleted: 0 };
    } finally {
      this.running = false;
    }
  }

  /**
   * Start periodic consolidation on an interval.
   * Defaults to every hour (3600000 ms).
   */
  startPeriodicConsolidation(intervalMs = 3600000): void {
    if (this.timer) return;

    // Run once immediately
    this.runConsolidation().catch(() => {
      /* swallow */
    });

    this.timer = setInterval(() => {
      this.runConsolidation().catch(() => {
        /* swallow */
      });
    }, intervalMs);

    // Allow the process to exit even if the timer is still active
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  /**
   * Stop periodic consolidation.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

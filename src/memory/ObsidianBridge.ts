/**
 * ObsidianBridge — 将记忆系统以 Obsidian 兼容的 Markdown 文件形式同步到本地。
 *
 * 每条记忆对应一个 .md 文件，用户可直接在 Obsidian 中查看/编辑。
 * 支持 [[wikilinks]] 交叉引用、YAML frontmatter、标签。
 *
 * 架构:
 *   MemoryStore (SQLite)  ←→  ObsidianBridge  ←→  .md 文件 (Obsidian 兼容)
 */
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryStore, MemoryEntry } from './MemoryStore.js';

export interface ObsidianBridgeOptions {
  /** 记忆文件的输出目录（默认 ./fricless-memory/） */
  outputDir?: string;
  /** 是否自动同步内存到文件 */
  autoSync?: boolean;
}

export class ObsidianBridge {
  private outputDir: string;
  private store: MemoryStore;
  private watcher: fs.FSWatcher | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(store: MemoryStore, opts: ObsidianBridgeOptions = {}) {
    this.store = store;
    this.outputDir = path.resolve(opts.outputDir || './fricless-memory');
    if (opts.autoSync !== false) {
      this.startAutoSync();
    }
  }

  /** 将所有记忆同步为 Markdown 文件 */
  async syncAllToFiles(): Promise<number> {
    const entries = await this.store.getAllEntries();
    fs.mkdirSync(this.outputDir, { recursive: true });
    let count = 0;

    for (const entry of entries) {
      const filePath = this.entryToFilePath(entry);
      const content = this.entryToMarkdown(entry);
      fs.writeFileSync(filePath, content, 'utf-8');
      count++;
    }

    return count;
  }

  /** 将单条记忆写入 Markdown 文件 */
  async writeEntry(entry: MemoryEntry): Promise<void> {
    fs.mkdirSync(this.outputDir, { recursive: true });
    const filePath = this.entryToFilePath(entry);
    fs.writeFileSync(filePath, this.entryToMarkdown(entry), 'utf-8');
  }

  /** 从 Markdown 文件读取记忆并存入 SQLite */
  async readFileToStore(filePath: string): Promise<void> {
    if (!filePath.endsWith('.md')) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const entry = this.markdownToEntry(content, filePath);
    if (entry) {
      await this.store.save(entry);
    }
  }

  /** 批量扫描目录，将新文件导入存储 */
  async importAllFromFiles(): Promise<number> {
    if (!fs.existsSync(this.outputDir)) return 0;
    const files = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.md'));
    let count = 0;
    for (const file of files) {
      await this.readFileToStore(path.join(this.outputDir, file));
      count++;
    }
    return count;
  }

  /** 启动周期性同步（每 60 秒检查文件变更） */
  startAutoSync(intervalMs = 60000): void {
    if (this.syncTimer) return;
    // 初始全量同步
    this.syncAllToFiles().catch(() => {});
    this.syncTimer = setInterval(() => {
      this.syncAllToFiles().catch(() => {});
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
  }

  /** 记忆 → 文件名（安全转义） */
  private entryToFilePath(entry: MemoryEntry): string {
    const safeName = entry.content
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return path.join(this.outputDir, `${safeName}.md`);
  }

  /** 记忆 → Obsidian Markdown */
  private entryToMarkdown(entry: MemoryEntry): string {
    const tags = entry.tags.map(t => `  - ${t}`).join('\n');
    const backlinks = `  - [[${entry.sessionId}]]`;

    return [
      '---',
      `id: ${entry.id}`,
      `session_id: ${entry.sessionId}`,
      `user_id: ${entry.userId}`,
      `category: ${entry.category}`,
      `confidence: ${entry.confidence}`,
      `created: ${new Date(entry.createdAt).toISOString()}`,
      `accessed: ${new Date(entry.lastAccessedAt).toISOString()}`,
      `access_count: ${entry.accessCount}`,
      'tags:',
      tags,
      'backlinks:',
      backlinks,
      '---',
      '',
      entry.content,
      '',
      `> 来源会话: [[${entry.sessionId}]]`,
    ].join('\n');
  }

  /** Obsidian Markdown → 记忆 */
  private markdownToEntry(content: string, filePath: string): Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'> | null {
    try {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
      if (!frontmatterMatch) return null;

      const meta: Record<string, string> = {};
      const body = content.slice(frontmatterMatch[0].length).trim();
      const lines = frontmatterMatch[1].split('\n');
      let currentKey = '';
      for (const line of lines) {
        if (line.startsWith('  - ')) {
          if (currentKey === 'tags') meta.tags = (meta.tags || '') + line.slice(4) + ',';
          continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          currentKey = line.slice(0, colonIdx).trim();
          meta[currentKey] = line.slice(colonIdx + 1).trim();
        }
      }

      if (!meta.category || !body) return null;

      return {
        sessionId: meta.session_id || 'unknown',
        userId: meta.user_id || 'unknown',
        content: body.slice(0, 500),
        category: meta.category as MemoryEntry['category'],
        confidence: parseFloat(meta.confidence || '0.5') as number,
        tags: meta.tags ? meta.tags.split(',').filter(Boolean) : [path.basename(filePath, '.md')],
      };
    } catch {
      return null;
    }
  }
}

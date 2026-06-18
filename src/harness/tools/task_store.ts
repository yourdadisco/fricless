/**
 * TaskStore — 共享的任务存储（内存 Map）
 *
 * 所有任务管理工具共享同一个静态 Map 实例。
 * 提供增删改查 + 停止操作。
 */

export interface TaskConfig {
  name?: string;
  description?: string;
  status?: string;
  output?: string;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  name?: string;
  description?: string;
  status: string;
  output?: string;
  createdAt: number;
  [key: string]: unknown;
}

export class TaskStore {
  static tasks = new Map<string, Task>();

  static addTask(id: string, config: TaskConfig): string {
    this.tasks.set(id, {
      id,
      ...config,
      status: config.status || 'running',
      createdAt: Date.now(),
    } as Task);
    return id;
  }

  static getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  static listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  static updateTask(id: string, updates: Partial<Task>): void {
    const t = this.tasks.get(id);
    if (t) Object.assign(t, updates);
  }

  static stopTask(id: string): void {
    const t = this.tasks.get(id);
    if (t) t.status = 'stopped';
  }

  static deleteTask(id: string): void {
    this.tasks.delete(id);
  }
}

/**
 * EventBus — 简单事件总线用于插件间通信
 *
 * 提供类型安全的 on/emit 机制。
 * on() 返回 unsubscribe 函数，方便插件清理时解绑。
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'eventbus' });

type Handler = (...args: unknown[]) => void | Promise<void>;

interface Listener {
  handler: Handler;
  once: boolean;
}

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  /**
   * 注册事件监听器
   * @returns 取消订阅函数
   */
  on(event: string, handler: Handler): () => void {
    const list = this.listeners.get(event) ?? new Set();
    const listener: Listener = { handler, once: false };
    list.add(listener);
    this.listeners.set(event, list);

    return () => {
      list.delete(listener);
      if (list.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * 注册一次性事件监听器
   * @returns 取消订阅函数
   */
  once(event: string, handler: Handler): () => void {
    const list = this.listeners.get(event) ?? new Set();
    const listener: Listener = { handler, once: true };
    list.add(listener);
    this.listeners.set(event, list);

    return () => {
      list.delete(listener);
      if (list.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * 触发事件，调用所有监听器
   * 异步监听器会被捕获异常，不会阻塞其他监听器
   */
  emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (!list || list.size === 0) return;

    const toRemove: Listener[] = [];

    for (const listener of list) {
      try {
        const result = listener.handler(...args);
        if (result instanceof Promise) {
          result.catch((err) => {
            logger.error({ err, event }, 'EventBus handler async error');
          });
        }
      } catch (err) {
        logger.error({ err, event }, 'EventBus handler error');
      }

      if (listener.once) {
        toRemove.push(listener);
      }
    }

    for (const l of toRemove) {
      list.delete(l);
    }
    if (list.size === 0) {
      this.listeners.delete(event);
    }
  }

  /** 移除指定事件的所有监听器 */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** 获取指定事件的监听器数量 */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

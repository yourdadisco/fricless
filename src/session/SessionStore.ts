/**
 * SessionStore — 兼容导出入口
 *
 * 原 SessionStore 类已重命名为 InMemorySessionStore。
 * 本文件提供向后兼容的重新导出。
 */
export { InMemorySessionStore as SessionStore } from './InMemorySessionStore.js';
export { InMemorySessionStore } from './InMemorySessionStore.js';

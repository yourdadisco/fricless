/**
 * PluginManager — 插件加载/卸载/生命周期管理
 *
 * 从指定目录动态加载所有插件，提供统一的生命周期管理。
 * 支持 loadAll / unload / list 等操作。
 */

import path from 'node:path';
import fs from 'node:fs';
import pino from 'pino';
import type { FriclessPlugin, PluginContext } from './PluginInterface.js';
import type { AnyTool } from '../harness/Tool.js';
import type { CommandDef } from '../harness/Command.js';
import { EventBus } from './EventBus.js';

const logger = pino({ name: 'plugin-manager' });

export class PluginManager {
  private plugins = new Map<string, FriclessPlugin>();
  private pluginTools = new Map<string, AnyTool[]>();
  private pluginCommands = new Map<string, CommandDef[]>();
  readonly eventBus = new EventBus();

  /**
   * 从指定目录加载所有插件
   * 每个插件应为独立子目录，包含 index.ts 作为入口
   */
  async loadAll(pluginDir: string): Promise<void> {
    if (!fs.existsSync(pluginDir)) {
      // 插件目录不存在不算异常，用户可能没装插件
      logger.debug({ pluginDir }, '插件目录不存在');
      return;
    }

    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(pluginDir, entry.name, 'index.ts');
      const manifestJsPath = path.join(pluginDir, entry.name, 'index.js');
      const entryPath = fs.existsSync(manifestPath) ? manifestPath :
                        fs.existsSync(manifestJsPath) ? manifestJsPath : null;

      if (entryPath) {
        await this.loadPlugin(entry.name, entryPath);
      }
    }

    logger.info({ count: this.plugins.size }, '插件加载完成');
  }

  /**
   * 加载单个插件
   */
  private async loadPlugin(name: string, filePath: string): Promise<void> {
    try {
      const pluginModule: { default?: FriclessPlugin } = await import(filePath);
      const plugin = pluginModule.default ?? (pluginModule as unknown as FriclessPlugin);

      if (!plugin.meta?.name) {
        logger.warn({ filePath }, '插件缺少 meta.name，跳过加载');
        return;
      }

      const pluginCtx: PluginContext = {
        logger: pino({ name: `plugin:${plugin.meta.name}` }),
        config: {},
        eventBus: this.eventBus,
      };

      // 先注册工具和命令（让 initialize 可以引用它们）
      const tools = plugin.registerTools?.() ?? [];
      if (tools.length > 0) this.pluginTools.set(plugin.meta.name, tools);

      const commands = plugin.registerCommands?.() ?? [];
      if (commands.length > 0) this.pluginCommands.set(plugin.meta.name, commands);

      // 初始化
      await plugin.initialize?.(pluginCtx);

      this.plugins.set(plugin.meta.name, plugin);

      logger.info(
        { name: plugin.meta.name, version: plugin.meta.version },
        '插件已加载',
      );
    } catch (err) {
      logger.error({ err, name, filePath }, '加载插件失败');
    }
  }

  /**
   * 卸载指定插件
   */
  async unload(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      logger.warn({ name }, '插件未找到，无法卸载');
      return;
    }

    try {
      await plugin.destroy?.();
    } catch (err) {
      logger.error({ err, name }, '插件销毁失败');
    }

    this.plugins.delete(name);
    this.pluginTools.delete(name);
    this.pluginCommands.delete(name);
    logger.info({ name }, '插件已卸载');
  }

  /**
   * 卸载所有插件
   */
  async unloadAll(): Promise<void> {
    const names = Array.from(this.plugins.keys());
    for (const name of names) {
      await this.unload(name);
    }
    this.eventBus.removeAll();
  }

  /** 获取所有已加载插件的 Tool */
  get allTools(): AnyTool[] {
    return Array.from(this.pluginTools.values()).flat();
  }

  /** 获取所有已加载插件的 Command */
  get allCommands(): CommandDef[] {
    return Array.from(this.pluginCommands.values()).flat();
  }

  /** 获取已加载插件名称列表 */
  get loadedPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /** 获取指定插件 */
  getPlugin(name: string): FriclessPlugin | undefined {
    return this.plugins.get(name);
  }

  /** 插件总数 */
  get count(): number {
    return this.plugins.size;
  }
}

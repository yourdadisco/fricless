import os from 'node:os';
import path from 'node:path';

/**
 * 解析文件路径，支持:
 * - ~ → 用户 home 目录
 * - 相对路径 → 相对于 home 目录
 * - 绝对路径 → 直接使用
 */
export function resolvePath(inputPath: string): string {
  const home = os.homedir();

  if (inputPath.startsWith('~')) {
    return path.resolve(home, inputPath.slice(1).replace(/^[/\\]/, ''));
  }

  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  // 相对路径：相对于 home 目录
  return path.resolve(home, inputPath);
}

/** 获取用户信息 */
export function getUserHome(): string {
  return os.homedir();
}

export function getUserName(): string {
  return os.userInfo().username;
}

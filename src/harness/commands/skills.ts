/**
 * Skills Command — 列出可用技能
 *
 * 对应斜杠命令:
 *   /skills [name] — 列出所有可用技能或查看特定技能
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface Skill {
  name: string;
  description: string;
  usage?: string;
}

export function createSkillsCommand(
  getSkills?: () => Skill[],
): CommandDef {
  return {
    name: 'skills',
    aliases: ['skill', 'abilities', 'capabilities'],
    description: '列出所有可用的技能',
    usage: '/skills [技能名称]',
    async execute(args: string[], ctx: CommandContext) {
      const skills = getSkills?.() ?? [
        { name: 'code-review', description: '审查代码变更', usage: '使用 /review 触发' },
        { name: 'web-search', description: '搜索网络信息', usage: '自动使用' },
        { name: 'file-edit', description: '编辑文件', usage: '自动使用' },
      ];

      const skillName = args.join(' ').trim().toLowerCase();

      if (skillName) {
        const skill = skills.find(s => s.name === skillName);
        if (skill) {
          const lines = [
            `🧠 **技能: \`${skill.name}\`**`,
            '---',
            `描述: ${skill.description}`,
            skill.usage ? `用法: ${skill.usage}` : '',
          ];
          await ctx.sendMessage(lines.filter(Boolean).join('\n'));
        } else {
          await ctx.sendMessage(`未找到技能 "${skillName}"。使用 \`/skills\` 查看所有技能。`);
        }
        return;
      }

      const lines = [
        '🧠 **可用技能**',
        '---',
        ...skills.map(s => `  • \`${s.name}\` — ${s.description}`),
        '---',
        '使用 \`/skills <name>\` 查看技能详情。',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}

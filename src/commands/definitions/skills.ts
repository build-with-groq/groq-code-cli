import { CommandDefinition, CommandContext } from '../base.js';
import { listSkills, getSkill } from '../../core/skills.js';

export const skillsCommand: CommandDefinition = {
  command: 'skills',
  description: 'List available skills',
  handler: ({ addMessage }: CommandContext) => {
    const skills = listSkills();
    if (skills.length === 0) {
      addMessage({
        role: 'system',
        content: [
          'No skills installed.',
          '',
          'Skills live in .groq/skills/<name>/SKILL.md (project) or ~/.groq/skills/<name>/SKILL.md (user).',
          '',
          'SKILL.md format:',
          '  ---',
          '  name: my-skill',
          '  description: What this skill does',
          '  ---',
          '',
          '  Instructions for the model when this skill is active.',
        ].join('\n'),
      });
      return;
    }
    const lines = skills.map((s) => {
      const path = s.path.includes(process.cwd()) ? '(project)' : '(user)';
      return `- ${s.name} ${path}: ${s.description || '(no description)'}`;
    });
    addMessage({ role: 'system', content: `Available skills:\n${lines.join('\n')}` });
  },
};

export async function loadSkillForAgent(name: string, addMessage: CommandContext['addMessage']): Promise<void> {
  const skill = getSkill(name);
  if (!skill) {
    addMessage({ role: 'system', content: `Skill not found: ${name}` });
    return;
  }
  // Inject the skill body as a system message so future turns know about it.
  addMessage({ role: 'system', content: `[SKILL ${skill.name} activated]\n${skill.content || skill.description}` });
}
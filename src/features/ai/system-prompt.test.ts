import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '@/features/ai/system-prompt';
import { getAiToolDefinitions } from '@/features/ai/tools';

describe('buildSystemPrompt task vs fact routing', () => {
  const base = {
    locale: 'ru' as const,
    familyRole: 'owner',
    familyMembers: [
      {
        id: 1,
        name: 'Олег',
        email: 'oleg@example.com',
        role: 'owner',
        kinshipLabel: 'husband',
        birthDate: '1990-01-01',
      },
      {
        id: 2,
        name: 'Дарья',
        email: 'darya@example.com',
        role: 'adult',
        kinshipLabel: 'wife',
        birthDate: '1995-01-01',
      },
    ],
    isNewConversation: false,
    clientNow: '2026-09-04T15:00:00+03:00',
    timeZone: 'Europe/Moscow',
  };

  it('includes device local time and family member ids', () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain('2026-09-04T15:00:00+03:00');
    expect(prompt).toContain('Europe/Moscow');
    expect(prompt).toContain('1:Олег:husband:owner:');
    expect(prompt).toContain('2:Дарья:wife:adult:');
  });

  it('steers facts to remember_note and actions to create_task', () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain('Separate facts from tasks');
    expect(prompt).toContain('passport in the living-room cabinet');
    expect(prompt).toContain('запомни купи молоко');
    expect(prompt).toContain('remember_note');
    expect(prompt).toContain('create_task');
    expect(prompt).toContain('default to assigning the current user');
  });

  it('mentions missing clientNow when not provided', () => {
    const prompt = buildSystemPrompt({
      ...base,
      clientNow: null,
      timeZone: null,
    });
    expect(prompt).toContain('User device local datetime was not provided');
  });
});

describe('task tool descriptions reinforce fact vs task split', () => {
  it('documents remember_note as facts and create_task as actions', () => {
    const tools = Object.fromEntries(
      getAiToolDefinitions().map((tool) => [tool.function.name, tool.function.description]),
    );

    expect(tools.remember_note).toMatch(/FACT/i);
    expect(tools.remember_note).toMatch(/create_task/);
    expect(tools.create_task).toMatch(/поручение|task|reminder/i);
    expect(tools.create_task).toMatch(/запомни купи|buy milk|remember_note/i);
  });
});

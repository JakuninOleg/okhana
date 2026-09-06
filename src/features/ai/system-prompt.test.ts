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
    expect(prompt).toContain('three different things');
    expect(prompt).toContain('NOTES (заметки)');
    expect(prompt).toContain('TASKS / ПОРУЧЕНИЯ');
    expect(prompt).toContain('passport is in the living-room cabinet');
    expect(prompt).toContain('запомни купи молоко');
    expect(prompt).toContain('remember_note');
    expect(prompt).toContain('create_task');
    expect(prompt).toContain('default to assigning the current user');
  });

  it('routes anniversaries to create_memorable_date not notes', () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain('MEMORABLE DATES');
    expect(prompt).toContain('create_memorable_date');
    expect(prompt).toContain('годовщина');
    expect(prompt).toMatch(/NEVER use remember_note/i);
    expect(prompt).toContain('памятная дата / заметка / поручение');
  });

  it('mentions missing clientNow when not provided', () => {
    const prompt = buildSystemPrompt({
      ...base,
      clientNow: null,
      timeZone: null,
    });
    expect(prompt).toContain('User device local datetime was not provided');
  });

  it('limits scope to family assistance and refuses politics and illegal topics', () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain('exclusively a family home assistant');
    expect(prompt).toContain('REFUSALS');
    expect(prompt).toMatch(/politics|elections|ideology/i);
    expect(prompt).toMatch(/Russian Federation|United States|European Union/i);
    expect(prompt).toContain('CHILD SAFETY');
  });

  it('requires kinship words to map to member ids for tasks', () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain('KINSHIP RESOLUTION');
    expect(prompt).toMatch(/мама\/маме/);
    expect(prompt).toMatch(/kinship "mom"/);
    expect(prompt).toContain('Never invent member ids');
    expect(prompt).toContain('only ever see what this user is allowed to see');
  });
});

describe('task tool descriptions reinforce fact vs task split', () => {
  it('documents remember_note as facts and create_task as actions', () => {
    const tools = Object.fromEntries(
      getAiToolDefinitions().map((tool) => [tool.function.name, tool.function.description]),
    );

    expect(tools.remember_note).toMatch(/FACT/i);
    expect(tools.remember_note).toMatch(/create_task/);
    expect(tools.remember_note).toMatch(/create_memorable_date/);
    expect(tools.create_task).toMatch(/поручение|task|reminder/i);
    expect(tools.create_task).toMatch(/запомни купи|buy milk|remember_note/i);
    expect(tools.create_memorable_date).toMatch(/anniversary|годовщина|birthday/i);
  });
});

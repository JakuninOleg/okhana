import { describe, it, expect } from 'vitest';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';

/**
 * Verify that translation keys are consistent across all locales.
 * Missing keys cause next-intl to throw at runtime, so these tests
 * catch regressions early before they reach production.
 */
describe('i18n message catalogs', () => {
  it('en.json and ru.json have the same top-level namespaces', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('Home.signIn exists in both locales', () => {
    expect(en.Home.signIn).toBe('Sign in');
    expect(ru.Home.signIn).toBe('Войти');
  });

  it('Dashboard.greeting exists in both locales and contains {email} placeholder', () => {
    expect(en.Dashboard.greeting).toContain('{email}');
    expect(ru.Dashboard.greeting).toContain('{email}');
  });

  it('Dashboard.signOut exists in both locales', () => {
    expect(en.Dashboard.signOut).toBe('Sign out');
    expect(ru.Dashboard.signOut).toBe('Выйти');
  });

  it('all nested keys in en.json exist in ru.json', () => {
    for (const namespace of Object.keys(en)) {
      const enKeys = Object.keys(en[namespace as keyof typeof en]);
      const ruKeys = Object.keys(ru[namespace as keyof typeof ru]);
      expect(enKeys.sort()).toEqual(ruKeys.sort());
    }
  });
});

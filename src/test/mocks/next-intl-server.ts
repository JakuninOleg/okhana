export async function getTranslations() {
  return (key: string, vars?: Record<string, string>) => {
    if (key === 'signIn') return 'Sign in';
    if (key === 'greeting') return `Hello, ${vars?.email ?? ''}`;
    if (key === 'signOut') return 'Sign out';
    return key;
  };
}

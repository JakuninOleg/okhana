'use client';

import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

export function ThemeToggle({ currentTheme }: { currentTheme: 'light' | 'dark' }) {
  const router = useRouter();

  function toggle() {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(next);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
      {currentTheme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}

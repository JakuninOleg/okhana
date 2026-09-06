'use client';

import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

export function ThemeToggle({ currentTheme }: { currentTheme: 'light' | 'dark' }) {
  const router = useRouter();
  // Optimistic UI: icon follows local state immediately; cookie + class update the look,
  // router.refresh() only syncs the server Navbar prop (can lag on a heavy RSC tree).
  const [theme, setTheme] = useState(currentTheme);
  const [prevTheme, setPrevTheme] = useState(currentTheme);
  // Sync from server prop without an effect (avoids cascading setState-in-effect lint).
  if (currentTheme !== prevTheme) {
    setPrevTheme(currentTheme);
    setTheme(currentTheme);
  }

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(next);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

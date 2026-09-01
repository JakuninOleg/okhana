'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function InviteCodeDisplay({ code }: { code: string }): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-3">
      <code className="flex-1 font-mono text-sm tracking-widest text-foreground">{code}</code>
      <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}

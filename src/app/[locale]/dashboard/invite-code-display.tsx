'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function InviteCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded border p-3">
      <code className="flex-1 font-mono text-sm">{code}</code>
      <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
}

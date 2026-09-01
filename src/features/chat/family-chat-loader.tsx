'use client';

import dynamic from 'next/dynamic';

/** Client-only boundary so the server page can keep `export const dynamic`. */
export const FamilyChatLoader = dynamic(
  () => import('@/features/chat/family-chat').then((module) => module.FamilyChat),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[24rem] w-full flex-1 animate-pulse rounded-3xl border border-border/60 bg-muted/30" />
    ),
  },
);

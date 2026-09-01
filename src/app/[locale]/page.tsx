import Image from 'next/image';
import { auth } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { Link, redirect } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale }, { userId }, t] = await Promise.all([
    params,
    auth(),
    getTranslations('Home'),
  ]);

  if (userId) {
    redirect({ href: '/dashboard', locale });
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden py-10 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--brand-sun)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom,_var(--brand-aqua)_0%,_transparent_50%)] opacity-70 dark:opacity-25"
      />
      <div className="relative flex max-w-xl flex-col items-center gap-6 text-center">
        <Image
          src="/brand/okhana-mark.webp"
          alt=""
          width={160}
          height={160}
          priority
          sizes="160px"
          className="size-36 rounded-full object-cover shadow-sm ring-2 ring-brand-peach/40 sm:size-40"
        />
        <div className="space-y-3">
          <p className="text-4xl font-semibold tracking-[0.12em] text-brand-teal dark:text-brand-cream sm:text-5xl">
            {t('brand')}
          </p>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-brand-peach">
            {t('tagline')}
          </p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('headline')}
          </h1>
          <p className="text-pretty text-base text-muted-foreground sm:text-lg">
            {t('pitch')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ size: 'lg' }), 'min-w-36')}
          >
            {t('signIn')}
          </Link>
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-w-36')}
          >
            {t('signUp')}
          </Link>
        </div>
      </div>
    </main>
  );
}

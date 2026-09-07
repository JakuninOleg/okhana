import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { LandingCompareBar } from '@/features/marketing/landing-page-v2';
import {
  CalendarPreview,
  ChatPreview,
  DashboardHeroPreview,
  PhonePreview,
  PrivacyPreview,
  TasksPreview,
} from '@/features/marketing/landing-product-previews';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type SectionTone = 'hero' | 'plain' | 'sun' | 'aqua' | 'closing';

const SECTION_TONE: Record<SectionTone, string> = {
  hero: cn(
    'bg-[radial-gradient(ellipse_110%_70%_at_50%_-5%,_var(--brand-sun)_0%,_transparent_55%),radial-gradient(ellipse_70%_55%_at_100%_60%,_var(--brand-aqua)_0%,_transparent_50%)]',
    'dark:bg-[radial-gradient(ellipse_110%_70%_at_50%_-5%,_color-mix(in_oklab,var(--brand-peach)_26%,transparent)_0%,_transparent_55%),radial-gradient(ellipse_70%_55%_at_100%_50%,_color-mix(in_oklab,var(--brand-aqua)_20%,transparent)_0%,_transparent_50%)]',
  ),
  plain: 'bg-background',
  sun: cn(
    'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand-sun)_50%,var(--background))_0%,color-mix(in_oklab,var(--brand-sun)_22%,var(--background))_100%)]',
    'dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand-peach)_12%,var(--background))_0%,color-mix(in_oklab,var(--brand-peach)_5%,var(--background))_100%)]',
  ),
  aqua: cn(
    'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand-aqua)_28%,var(--background))_0%,color-mix(in_oklab,var(--brand-aqua)_12%,var(--background))_100%)]',
    'dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand-aqua)_14%,var(--background))_0%,color-mix(in_oklab,var(--brand-aqua)_6%,var(--background))_100%)]',
  ),
  closing: cn(
    'bg-[radial-gradient(ellipse_90%_80%_at_50%_100%,_var(--brand-sun)_0%,_transparent_60%),linear-gradient(180deg,color-mix(in_oklab,var(--brand-peach)_14%,var(--background))_0%,var(--background)_100%)]',
    'dark:bg-[radial-gradient(ellipse_90%_80%_at_50%_110%,_color-mix(in_oklab,var(--brand-peach)_18%,transparent)_0%,_transparent_55%),linear-gradient(180deg,color-mix(in_oklab,var(--brand-peach)_8%,var(--background))_0%,var(--background)_100%)]',
  ),
};

function LandingSection({
  tone,
  className,
  children,
  id,
}: {
  tone: SectionTone;
  className?: string;
  children: React.ReactNode;
  id?: string;
}): React.JSX.Element {
  return (
    <section
      id={id}
      className={cn(
        'relative px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24',
        SECTION_TONE[tone],
        className,
      )}
    >
      {children}
    </section>
  );
}

export async function LandingPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('Home');

  return (
    <main className="relative flex w-full flex-1 flex-col">
      <LandingCompareBar active="v1" />
      <LandingSection tone="hero" className="overflow-hidden py-12 sm:py-16 lg:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-20 size-64 rounded-full bg-brand-peach/15 blur-3xl dark:bg-brand-peach/12 sm:size-80"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-10 size-56 rounded-full bg-brand-aqua/20 blur-3xl dark:bg-brand-aqua/12 sm:size-72"
        />

        <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <Image
              src="/brand/okhana-mark.webp"
              alt=""
              width={144}
              height={144}
              priority
              sizes="144px"
              className="size-28 rounded-full object-cover shadow-md ring-2 ring-brand-peach/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 sm:size-32"
            />
            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
              <p className="text-4xl font-semibold tracking-[0.14em] text-brand-teal dark:text-brand-cream sm:text-5xl lg:text-6xl">
                {t('brand')}
              </p>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-brand-peach">
                {t('tagline')}
              </p>
              <h1 className="max-w-xl text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                {t('headline')}
              </h1>
              <p className="max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                {t('pitch')}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({ variant: 'cta', size: 'lg' }),
                  'min-h-11 min-w-40 text-base font-semibold',
                )}
              >
                {t('ctaPrimary')}
              </Link>
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'min-h-11 min-w-40 border-border/80 bg-background/60',
                )}
              >
                {t('signIn')}
              </Link>
            </div>
          </div>

          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-100">
            <DashboardHeroPreview />
          </div>
        </div>
      </LandingSection>

      <LandingSection tone="sun" className="py-14 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('problem.title')}
          </h2>
          <p className="text-pretty text-muted-foreground sm:text-lg">
            {t('problem.body')}
          </p>
        </div>
      </LandingSection>

      <LandingSection tone="aqua" className="space-y-12 sm:space-y-16">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('features.title')}
          </h2>
          <p className="text-pretty text-muted-foreground sm:text-lg">
            {t('features.subtitle')}
          </p>
        </div>
        <FeatureRow
          eyebrow={t('features.chat.eyebrow')}
          title={t('features.chat.title')}
          body={t('features.chat.body')}
          preview={<ChatPreview className="min-h-[24rem]" />}
        />
      </LandingSection>

      <LandingSection tone="plain" className="space-y-14 sm:space-y-16">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('wins.title')}
          </h2>
          <p className="text-pretty text-muted-foreground sm:text-lg">
            {t('wins.subtitle')}
          </p>
        </div>
        <FeatureRow
          eyebrow={t('wins.tasks.eyebrow')}
          title={t('wins.tasks.title')}
          body={t('wins.tasks.body')}
          preview={<TasksPreview />}
          reverse
        />
        <FeatureRow
          eyebrow={t('wins.notes.eyebrow')}
          title={t('wins.notes.title')}
          body={t('wins.notes.body')}
          preview={<PrivacyPreview />}
        />
        <FeatureRow
          eyebrow={t('wins.calendar.eyebrow')}
          title={t('wins.calendar.title')}
          body={t('wins.calendar.body')}
          preview={<CalendarPreview />}
          reverse
        />
        <FeatureRow
          eyebrow={t('wins.phone.eyebrow')}
          title={t('wins.phone.title')}
          body={t('wins.phone.body')}
          preview={<PhonePreview />}
        />
      </LandingSection>

      <LandingSection tone="sun">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('privacy.title')}
            </h2>
            <p className="text-pretty text-muted-foreground sm:text-lg">
              {t('privacy.body')}
            </p>
          </div>
          <ol className="mx-auto grid max-w-4xl gap-5 text-left sm:grid-cols-3">
            {([1, 2, 3] as const).map((step) => (
              <li
                key={step}
                className="rounded-2xl bg-background/70 p-4 ring-1 ring-border/40 dark:bg-card/55"
              >
                <p className="text-sm font-semibold text-brand-teal dark:text-brand-peach">
                  {t(`privacy.step${step}Title`)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`privacy.step${step}Body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </LandingSection>

      <LandingSection tone="aqua">
        <div className="mx-auto max-w-5xl space-y-10">
          <h2 className="text-center text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('steps.title')}
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {(['one', 'two', 'three'] as const).map((key, index) => (
              <li
                key={key}
                className="space-y-3 rounded-3xl bg-background/70 p-5 text-center ring-1 ring-border/50 dark:bg-card/55 sm:text-left"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-sun/90 text-sm font-semibold text-brand-teal ring-1 ring-brand-peach/35 dark:bg-brand-peach/25 dark:text-brand-cream">
                  {index + 1}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground sm:text-base">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </LandingSection>

      <LandingSection tone="closing" className="py-20 sm:py-28">
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-brand-peach">
            {t('tagline')}
          </p>
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('closing.title')}
          </h2>
          <p className="text-pretty text-muted-foreground sm:text-lg">
            {t('closing.body')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({ variant: 'cta', size: 'lg' }),
                'min-h-11 min-w-40 text-base font-semibold',
              )}
            >
              {t('ctaPrimary')}
            </Link>
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'min-h-11 min-w-40 border-border/80 bg-background/60',
              )}
            >
              {t('signIn')}
            </Link>
          </div>
        </div>
      </LandingSection>
    </main>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  preview,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  preview: React.ReactNode;
  reverse?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-[1400px] items-center gap-8 lg:grid-cols-2 lg:gap-14',
        reverse && 'lg:[&>*:first-child]:order-2',
      )}
    >
      <div className="mx-auto max-w-xl space-y-3 lg:mx-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-peach">
          {eyebrow}
        </p>
        <h3 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h3>
        <p className="text-pretty text-muted-foreground sm:text-lg">{body}</p>
      </div>
      <div>{preview}</div>
    </div>
  );
}

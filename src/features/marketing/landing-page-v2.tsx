import Image from 'next/image';
import { Source_Serif_4 } from 'next/font/google';
import {
  CalendarDays,
  KeyRound,
  ListTodo,
  Lock,
  Smartphone,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import {
  ChatPreview,
  HubPreview,
  TasksPreview,
} from '@/features/marketing/landing-product-previews';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const displaySerif = Source_Serif_4({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700'],
  variable: '--font-landing-display',
  display: 'swap',
});

/** Accent ink — peach in light only; sage/cream in dark to avoid orange flood. */
const accentLabel =
  'text-brand-peach dark:text-brand-sage';

function CompareBar({
  active,
  label,
  v1,
  v2,
}: {
  active: 'v1' | 'v2';
  label: string;
  v1: string;
  v2: string;
}): React.JSX.Element {
  return (
    <div className="sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6 lg:px-10">
        <p className="text-muted-foreground">{label}</p>
        <div className="flex gap-2">
          <Link
            href="/"
            className={cn(
              'rounded-full px-3 py-1 font-medium ring-1 transition-colors',
              active === 'v1'
                ? 'bg-brand-teal/10 text-brand-teal ring-brand-teal/30 dark:bg-brand-cream/10 dark:text-brand-cream dark:ring-brand-cream/25'
                : 'bg-background text-muted-foreground ring-border/60 hover:text-foreground',
            )}
          >
            {v1}
          </Link>
          <Link
            href="/landing-v2"
            className={cn(
              'rounded-full px-3 py-1 font-medium ring-1 transition-colors',
              active === 'v2'
                ? 'bg-brand-teal/10 text-brand-teal ring-brand-teal/30 dark:bg-brand-cream/10 dark:text-brand-cream dark:ring-brand-cream/25'
                : 'bg-background text-muted-foreground ring-border/60 hover:text-foreground',
            )}
          >
            {v2}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Landing CTAs: terracotta + white in light (as reference).
 * Dark: cream on deep teal — no peach fill, no pale-on-orange.
 */
function CtaPair({
  primary,
  signIn,
}: {
  primary: string;
  signIn: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/sign-up"
        className={cn(
          buttonVariants({ size: 'lg' }),
          'min-h-11 min-w-40 rounded-full px-6 text-base font-semibold shadow-sm',
          'bg-[#d8895c] text-white hover:bg-[#c97a4f]',
          'dark:bg-brand-cream dark:text-[#0f1c1b] dark:hover:bg-white',
        )}
      >
        {primary}
      </Link>
      <Link
        href="/sign-in"
        className={cn(
          buttonVariants({ variant: 'outline', size: 'lg' }),
          'min-h-11 min-w-32 rounded-full px-6',
          'border-brand-teal/20 bg-background/80 text-brand-teal',
          'dark:border-brand-cream/25 dark:bg-transparent dark:text-brand-cream',
        )}
      >
        {signIn}
      </Link>
    </div>
  );
}

function DisplayHeading({
  children,
  className,
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}): React.JSX.Element {
  return (
    <Tag
      className={cn(
        displaySerif.className,
        'text-balance font-semibold tracking-tight text-brand-teal dark:text-brand-cream',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

function HeroStack(): React.JSX.Element {
  return (
    <div className="relative mx-auto min-h-[28rem] w-full max-w-xl lg:min-h-[32rem]">
      <div className="absolute left-0 top-4 z-[1] w-[76%] max-w-sm -rotate-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 sm:left-2">
        <HubPreview />
      </div>
      <div className="absolute right-0 top-[36%] z-[2] w-[80%] max-w-sm rotate-1 motion-safe:animate-in motion-safe:fade-in motion-safe:delay-100 motion-safe:duration-700 sm:right-1">
        <TasksPreview />
      </div>
      <div className="absolute bottom-0 left-[10%] z-[3] w-[86%] max-w-md -rotate-1 motion-safe:animate-in motion-safe:fade-in motion-safe:delay-150 motion-safe:duration-700">
        <ChatPreview className="max-h-[15rem] overflow-hidden sm:max-h-[17rem]" />
      </div>
    </div>
  );
}

function FeatureIconCard({
  eyebrow,
  title,
  body,
  icon,
  className,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-[1.5rem] bg-card p-5 shadow-[0_14px_40px_-28px_rgba(26,53,51,0.35)] ring-1 ring-border/40',
        'dark:bg-card/80 dark:ring-border/30',
        className,
      )}
    >
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-sun/70 text-[#c97a4f] dark:bg-brand-sage/20 dark:text-brand-sage">
        {icon}
      </span>
      <div className="space-y-2">
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', accentLabel)}>
          {eyebrow}
        </p>
        <h3 className={cn(displaySerif.className, 'text-lg font-semibold tracking-tight sm:text-xl')}>
          {title}
        </h3>
        <p className="text-pretty text-sm text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}

/**
 * Marketing landing v2 — reference composition for A/B visual comparison with v1.
 */
export async function LandingPageV2(): Promise<React.JSX.Element> {
  const t = await getTranslations('Home');

  return (
    <main
      className={cn(
        displaySerif.variable,
        'relative flex w-full flex-1 flex-col',
        'bg-[#fbf8f3] dark:bg-background',
      )}
    >
      <LandingCompareBar active="v2" />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,_color-mix(in_oklab,var(--brand-sun)_55%,transparent)_0%,_transparent_55%),radial-gradient(ellipse_45%_40%_at_100%_20%,_color-mix(in_oklab,var(--brand-aqua)_40%,transparent)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_60%_45%_at_10%_0%,_color-mix(in_oklab,var(--brand-sage)_18%,transparent)_0%,_transparent_55%)]"
        />
        <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
          <div className="flex flex-col gap-6 lg:max-w-xl">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/okhana-mark.webp"
                alt=""
                width={56}
                height={56}
                priority
                sizes="56px"
                className="size-14 rounded-full object-cover shadow-sm ring-1 ring-brand-teal/15 dark:ring-brand-cream/20"
              />
              <div>
                <p className="text-2xl font-semibold tracking-[0.12em] text-brand-teal dark:text-brand-cream">
                  {t('brand')}
                </p>
                <p className={cn('text-[11px] font-medium uppercase tracking-[0.24em]', accentLabel)}>
                  {t('tagline')}
                </p>
              </div>
            </div>

            <DisplayHeading as="h1" className="text-4xl sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
              {t('headline')}
            </DisplayHeading>
            <p className="max-w-lg text-pretty text-base text-muted-foreground sm:text-lg">
              {t('pitchShort')}
            </p>

            <div className="space-y-3 rounded-[1.5rem] bg-white/80 p-4 shadow-sm ring-1 ring-border/40 dark:bg-card/70 dark:ring-border/30">
              <p className="text-sm text-muted-foreground">{t('heroPromptLead')}</p>
              <p className="rounded-2xl bg-[#f3eee6] px-4 py-3 text-sm font-medium text-brand-teal dark:bg-white/5 dark:text-brand-cream">
                {t('heroPromptExample')}
              </p>
              <p className="text-sm text-muted-foreground">{t('heroPromptHint')}</p>
            </div>

            <CtaPair primary={t('ctaPrimary')} signIn={t('signIn')} />
          </div>

          <HeroStack />
        </div>
      </section>

      {/* Problem + lifestyle photo */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-32px_rgba(26,53,51,0.4)] ring-1 ring-border/30">
            <Image
              src="/brand/marketing/woman-relaxed.webp"
              alt=""
              width={960}
              height={720}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="aspect-[4/3] w-full object-cover"
            />
            <p className="absolute bottom-5 left-5 right-5 max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-sm font-medium text-brand-teal shadow-sm ring-1 ring-black/5 dark:bg-[#152422]/95 dark:text-brand-cream dark:ring-white/10">
              {t('problemCaption')}
            </p>
          </div>
          <div className="space-y-4 lg:max-w-xl">
            <DisplayHeading className="text-3xl sm:text-4xl">{t('problem.title')}</DisplayHeading>
            <p className="text-pretty text-base text-muted-foreground sm:text-lg">
              {t('problem.body')}
            </p>
          </div>
        </div>
      </section>

      {/* Just write */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 rounded-[2rem] bg-white/70 p-6 ring-1 ring-border/35 dark:bg-card/40 dark:ring-border/25 sm:p-8 lg:grid-cols-2 lg:gap-14 lg:p-10">
          <div className="space-y-4 lg:max-w-xl">
            <p className={cn('text-xs font-semibold uppercase tracking-[0.22em]', accentLabel)}>
              {t('features.title')}
            </p>
            <DisplayHeading className="text-3xl sm:text-4xl">
              {t('features.subtitle')}
            </DisplayHeading>
            <p className="text-pretty text-base text-muted-foreground sm:text-lg">
              {t('features.chat.title')}
            </p>
            <p className="text-pretty text-sm text-muted-foreground sm:text-base">
              {t('features.chat.body')}
            </p>
          </div>
          <ChatPreview className="min-h-[26rem]" />
        </div>
      </section>

      {/* Wins — icon cards like reference, not orange panels */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10">
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <p className={cn('text-xs font-semibold uppercase tracking-[0.22em]', accentLabel)}>
              {t('winsEyebrow')}
            </p>
            <DisplayHeading className="text-3xl sm:text-4xl">{t('wins.title')}</DisplayHeading>
            <p className="text-pretty text-muted-foreground sm:text-lg">{t('wins.subtitle')}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureIconCard
              eyebrow={t('wins.tasks.eyebrow')}
              title={t('wins.tasks.title')}
              body={t('wins.tasks.body')}
              icon={<ListTodo className="size-5" aria-hidden />}
            />
            <FeatureIconCard
              eyebrow={t('wins.notes.eyebrow')}
              title={t('wins.notes.title')}
              body={t('wins.notes.body')}
              icon={<KeyRound className="size-5" aria-hidden />}
            />
            <FeatureIconCard
              eyebrow={t('winsPrivacy.eyebrow')}
              title={t('winsPrivacy.title')}
              body={t('winsPrivacy.body')}
              icon={<Lock className="size-5" aria-hidden />}
            />
            <FeatureIconCard
              eyebrow={t('wins.calendar.eyebrow')}
              title={t('wins.calendar.title')}
              body={t('wins.calendar.body')}
              icon={<CalendarDays className="size-5" aria-hidden />}
            />
            <FeatureIconCard
              eyebrow={t('wins.phone.eyebrow')}
              title={t('wins.phone.title')}
              body={t('wins.phone.body')}
              icon={<Smartphone className="size-5" aria-hidden />}
            />
            <aside
              className={cn(
                displaySerif.className,
                'flex items-end rounded-[1.5rem] bg-brand-sage/12 p-6 text-lg font-semibold leading-snug text-brand-teal ring-1 ring-brand-sage/20',
                'dark:bg-brand-sage/15 dark:text-brand-cream dark:ring-brand-sage/25',
              )}
            >
              {t('winsAside')}
            </aside>
          </div>
        </div>
      </section>

      {/* Secrets + gift photo */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] gap-8 overflow-hidden rounded-[2rem] bg-white p-6 ring-1 ring-border/35 dark:bg-card/50 dark:ring-border/25 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:p-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <DisplayHeading className="text-3xl sm:text-4xl">{t('privacy.title')}</DisplayHeading>
              <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
                {t('privacy.body')}
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {([1, 2, 3] as const).map((step) => (
                <li
                  key={step}
                  className="rounded-2xl bg-[#f7f3ec] p-4 ring-1 ring-border/35 dark:bg-background/40 dark:ring-border/25"
                >
                  <p className="text-sm font-semibold text-brand-teal dark:text-brand-cream">
                    {t(`privacy.step${step}Title`)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`privacy.step${step}Body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative min-h-[16rem] overflow-hidden rounded-[1.5rem] ring-1 ring-border/30">
            <Image
              src="/brand/marketing/gift-box.webp"
              alt=""
              width={800}
              height={600}
              sizes="(max-width: 1024px) 100vw, 30vw"
              className="h-full w-full object-cover"
            />
            <p className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 px-4 py-3 text-center text-sm font-medium text-brand-teal shadow-sm dark:bg-[#152422]/95 dark:text-brand-cream">
              {t('giftTag')}
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-[1400px] space-y-10">
          <DisplayHeading className="text-center text-3xl sm:text-4xl">
            {t('steps.title')}
          </DisplayHeading>
          <ol className="grid gap-5 sm:grid-cols-3">
            {(['one', 'two', 'three'] as const).map((key, index) => (
              <li
                key={key}
                className="rounded-[1.5rem] bg-card p-6 shadow-[0_14px_40px_-28px_rgba(26,53,51,0.3)] ring-1 ring-border/40 dark:bg-card/70"
              >
                <p className={cn('text-sm font-semibold tracking-[0.18em]', accentLabel)}>
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className={cn(displaySerif.className, 'mt-3 text-xl font-semibold')}>
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing over nature */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-28 lg:px-10">
        <Image
          src="/brand/marketing/nature-footer.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-40 dark:opacity-25"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#fbf8f3] via-[#fbf8f3]/85 to-[#fbf8f3]/40 dark:from-background dark:via-background/90 dark:to-background/50"
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <p className={cn('text-sm font-medium uppercase tracking-[0.24em]', accentLabel)}>
            {t('tagline')}
          </p>
          <DisplayHeading className="text-3xl sm:text-4xl">{t('closing.title')}</DisplayHeading>
          <p className="text-pretty text-muted-foreground sm:text-lg">{t('closing.body')}</p>
          <CtaPair primary={t('ctaPrimary')} signIn={t('signIn')} />
        </div>
      </section>
    </main>
  );
}

/** Sticky compare bar — friends can switch v1 ↔ v2 on Production too. */
export async function LandingCompareBar({
  active,
}: {
  active: 'v1' | 'v2';
}): Promise<React.JSX.Element> {
  const t = await getTranslations('Home');
  return (
    <CompareBar
      active={active}
      label={t('compare.label')}
      v1={t('compare.v1')}
      v2={t('compare.v2')}
    />
  );
}

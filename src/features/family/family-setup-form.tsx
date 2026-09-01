'use client';

import { Home, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { createFamily, joinFamily } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ActionState = { error: string } | null;
type SetupStep = 'choose' | 'create' | 'join';

async function createFamilyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createFamily(formData);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'error' };
  }
}

async function joinFamilyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await joinFamily(formData);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'error' };
  }
}

type FamilySetupFormProps = {
  className?: string;
};

export function FamilySetupForm({ className }: FamilySetupFormProps): React.JSX.Element {
  const t = useTranslations('Dashboard.onboarding');
  const [step, setStep] = useState<SetupStep>('choose');
  const [createState, createFormAction, isCreating] = useActionState(
    createFamilyAction,
    null,
  );
  const [joinState, joinFormAction, isJoining] = useActionState(
    joinFamilyAction,
    null,
  );

  if (step === 'choose') {
    return (
      <div className={cn('grid w-full gap-3 sm:gap-4', className)}>
        <button
          type="button"
          onClick={() => setStep('create')}
          className="rounded-2xl border border-border/60 bg-card/90 p-4 text-left shadow-sm transition-colors hover:border-brand-peach/50 hover:bg-card sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-peach/15 text-brand-peach">
              <Home className="size-5" aria-hidden />
            </span>
            <span className="space-y-1">
              <span className="block text-base font-semibold text-foreground">
                {t('chooseCreateTitle')}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t('chooseCreateDescription')}
              </span>
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStep('join')}
          className="rounded-2xl border border-border/60 bg-card/90 p-4 text-left shadow-sm transition-colors hover:border-brand-aqua/50 hover:bg-card sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-aqua/20 text-brand-teal dark:text-brand-aqua">
              <Users className="size-5" aria-hidden />
            </span>
            <span className="space-y-1">
              <span className="block text-base font-semibold text-foreground">
                {t('chooseJoinTitle')}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t('chooseJoinDescription')}
              </span>
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <Card className={cn('w-full border-border/60 bg-card/90 shadow-sm backdrop-blur-sm', className)}>
      <CardHeader className="gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-1 w-fit px-0 text-muted-foreground hover:text-foreground"
          onClick={() => setStep('choose')}
        >
          ← {t('back')}
        </Button>
        <CardTitle className="text-xl">
          {step === 'create' ? t('createTitle') : t('joinTitle')}
        </CardTitle>
        <CardDescription>
          {step === 'create' ? t('createDescription') : t('joinDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'create' ? (
          <form action={createFormAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('familyNameLabel')}</Label>
              <Input
                id="name"
                name="name"
                required
                disabled={isCreating}
                autoFocus
                placeholder={t('familyNamePlaceholder')}
                className="h-11"
              />
            </div>
            {createState?.error ? (
              <p className="text-sm text-destructive" role="alert">
                {createState.error}
              </p>
            ) : null}
            <Button type="submit" disabled={isCreating} className="h-11 w-full">
              {isCreating ? t('createSubmitting') : t('createSubmit')}
            </Button>
          </form>
        ) : (
          <form action={joinFormAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">{t('inviteCodeLabel')}</Label>
              <Input
                id="inviteCode"
                name="inviteCode"
                required
                disabled={isJoining}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                placeholder={t('inviteCodePlaceholder')}
                className="h-11 font-mono uppercase tracking-widest"
              />
              <p className="text-xs text-muted-foreground">{t('inviteCodeHint')}</p>
            </div>
            {joinState?.error ? (
              <p className="text-sm text-destructive" role="alert">
                {joinState.error}
              </p>
            ) : null}
            <Button type="submit" disabled={isJoining} className="h-11 w-full">
              {isJoining ? t('joinSubmitting') : t('joinSubmit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

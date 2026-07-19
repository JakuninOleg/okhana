'use client';

import { useActionState } from 'react';
import { createFamily, joinFamily } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ActionState = { error: string } | null;

async function createFamilyAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await createFamily(formData);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong' };
  }
}

async function joinFamilyAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await joinFamily(formData);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong' };
  }
}

export function FamilySetupForm() {
  const [createState, createFormAction, isCreating] = useActionState(
    createFamilyAction,
    null
  );
  const [joinState, joinFormAction, isJoining] = useActionState(
    joinFamilyAction,
    null
  );

  return (
    <div className="grid gap-6 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Create a family</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createFormAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Family name</Label>
              <Input
                id="name"
                name="name"
                required
                disabled={isCreating}
              />
            </div>
            {createState?.error && (
              <p className="text-sm text-destructive">{createState.error}</p>
            )}
            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join a family</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={joinFormAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                name="inviteCode"
                required
                disabled={isJoining}
              />
            </div>
            {joinState?.error && (
              <p className="text-sm text-destructive">{joinState.error}</p>
            )}
            <Button
              type="submit"
              disabled={isJoining}
              variant="outline"
              className="w-full"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

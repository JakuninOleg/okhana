import { customAlphabet } from 'nanoid';

// Excludes ambiguous characters (0/O, 1/I/l) and uses uppercase only —
// this code is meant to be read aloud or typed by hand between family members.
const inviteCodeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateInviteCodeId = customAlphabet(inviteCodeAlphabet, 8);

export function generateInviteCode(): string {
  return generateInviteCodeId();
}

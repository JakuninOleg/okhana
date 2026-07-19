export function redirect(): never {
  throw new Error('NEXT_REDIRECT');
}

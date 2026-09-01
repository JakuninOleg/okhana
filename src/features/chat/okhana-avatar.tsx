import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** Compressed circular emblem — ~6KB WebP, not the full wordmark logo. */
const OKHANA_AVATAR_SRC = '/brand/okhana-mark.webp';

type OkhanaAvatarProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

/**
 * Okhana character mark — logo circle from the brand kit.
 */
export function OkhanaAvatar({
  size = 'md',
  className,
  label = 'Okhana',
}: OkhanaAvatarProps): React.JSX.Element {
  return (
    <Avatar
      size={size}
      alt={label}
      src={OKHANA_AVATAR_SRC}
      fallback="O"
      className={cn(
        'bg-brand-cream text-brand-teal shadow-sm ring-2 ring-brand-peach/35',
        className,
      )}
    />
  );
}

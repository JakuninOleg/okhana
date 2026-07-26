import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const OKHANA_AVATAR_SRC = '/okhana-avatar.svg';

type OkhanaAvatarProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
  /** When true, prefer the optional public asset; falls back to monogram if missing is fine via CSS letter. */
  preferAsset?: boolean;
};

/**
 * Okhana character mark. Swap-ready: drop a real asset at `public/okhana-avatar.svg`
 * and pass `preferAsset`. Until then, the emerald monogram is the brand face.
 */
export function OkhanaAvatar({
  size = 'md',
  className,
  label = 'Okhana',
  preferAsset = false,
}: OkhanaAvatarProps): React.JSX.Element {
  return (
    <Avatar
      size={size}
      alt={label}
      src={preferAsset ? OKHANA_AVATAR_SRC : null}
      fallback="O"
      className={cn(
        'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/15',
        className,
      )}
    />
  );
}

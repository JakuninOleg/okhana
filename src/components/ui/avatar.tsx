import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground select-none',
  {
    variants: {
      size: {
        sm: 'size-8 text-xs',
        md: 'size-9 text-sm',
        lg: 'size-12 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

type AvatarProps = VariantProps<typeof avatarVariants> & {
  className?: string;
  alt?: string;
  src?: string | null;
  fallback: string;
};

export function Avatar({
  className,
  size = 'md',
  alt = '',
  src,
  fallback,
}: AvatarProps): React.JSX.Element {
  const initials = fallback.trim().slice(0, 2).toUpperCase() || '?';

  return (
    <span
      data-slot="avatar"
      className={cn(avatarVariants({ size }), className)}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar; avoid next/image layout constraints in chat rows
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <span className="font-semibold tracking-tight">{initials}</span>
      )}
    </span>
  );
}

export { avatarVariants };

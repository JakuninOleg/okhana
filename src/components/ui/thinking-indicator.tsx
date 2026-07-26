import { cn } from '@/lib/utils';

type ThinkingIndicatorProps = {
  label: string;
  className?: string;
};

export function ThinkingIndicator({
  label,
  className,
}: ThinkingIndicatorProps): React.JSX.Element {
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-foreground/50 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-foreground/50 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-foreground/50" />
      </span>
      <span className="animate-pulse text-sm">{label}</span>
    </span>
  );
}

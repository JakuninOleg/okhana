import { cn } from '@/lib/utils';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Container({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-4 max-w-6xl', className)} {...props}>
      {children}
    </div>
  );
}
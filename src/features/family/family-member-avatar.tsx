import Image from 'next/image';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardFamilyMemberProfile } from '@/features/family/family-member-types';
import { resolveMemberAvatarVisual } from '@/features/family/member-avatar-visual';

const SIZE_CLASS = {
  sm: 'size-10',
  md: 'size-12',
  lg: 'size-16',
  xl: 'size-20',
  '2xl': 'size-24',
} as const;

const IMAGE_PX = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
} as const;

type FamilyMemberAvatarProps = {
  member: Pick<
    DashboardFamilyMemberProfile,
    'kinshipLabel' | 'profileSex' | 'familyRole' | 'birthDate'
  >;
  size?: keyof typeof SIZE_CLASS;
  showOwnerBadge?: boolean;
  className?: string;
  alt?: string;
};

export function FamilyMemberAvatar({
  member,
  size = 'md',
  showOwnerBadge = false,
  className,
  alt,
}: FamilyMemberAvatarProps): React.JSX.Element {
  const visual = resolveMemberAvatarVisual(member);
  const isOwner = showOwnerBadge && member.familyRole === 'owner';
  const px = IMAGE_PX[size];

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      role={alt ? 'img' : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
    >
      <span
        className={cn(
          'relative overflow-hidden rounded-full bg-brand-cream ring-2 ring-inset',
          SIZE_CLASS[size],
          visual.shellClass,
        )}
      >
        <Image
          src={visual.imageSrc}
          alt=""
          width={px}
          height={px}
          className="size-full object-cover"
          sizes={`${px}px`}
        />
      </span>
      {isOwner ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-brand-peach text-brand-teal ring-2 ring-background"
          aria-hidden
        >
          <Crown className="size-3" strokeWidth={2} />
        </span>
      ) : null}
    </span>
  );
}

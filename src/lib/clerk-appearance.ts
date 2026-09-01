import { shadcn } from '@clerk/ui/themes';
import { brand } from '@/lib/brand';

/**
 * Clerk reads CSS `color-scheme` on <html> (see globals.css), not our cookie alone.
 * shadcn theme maps Clerk tokens to our design-system CSS variables.
 */
export const clerkAppearance = {
  theme: shadcn,
  variables: {
    colorPrimary: brand.colors.teal,
    borderRadius: '0.75rem',
  },
  elements: {
    // Match Okhana inputs — avoid the default dark grey slab from shadcn's dark: modifier.
    input: 'bg-background border-border shadow-xs',
    cardBox: 'shadow-sm border border-border/60 bg-card/95 backdrop-blur-sm',
  },
};

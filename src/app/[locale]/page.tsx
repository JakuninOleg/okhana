import { auth } from '@clerk/nextjs/server';
import { redirect } from '@/i18n/navigation';

// Force dynamic rendering — auth() requires request context from middleware.
// Without this, Next.js prerenders the page during build (via generateStaticParams
// in the layout), and auth() fails because no middleware has run.
export const dynamic = 'force-dynamic';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale }, { userId }] = await Promise.all([params, auth()]);

  // Authenticated users are redirected to the dashboard — the home page
  // is only for unauthenticated visitors who need to sign in.
  if (userId) {
    redirect({ href: '/dashboard', locale });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p>Hello!</p>
    </main>
  );
}



import { SignIn } from '@clerk/nextjs';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignIn
        fallbackRedirectUrl={`/${locale}/dashboard`}
        forceRedirectUrl={`/${locale}/dashboard`}
      />
    </main>
  );
}



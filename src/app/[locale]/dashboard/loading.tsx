export default function DashboardLoading(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-[32rem] w-full max-w-2xl animate-pulse rounded-3xl border border-border/60 bg-muted/30" />
    </main>
  );
}

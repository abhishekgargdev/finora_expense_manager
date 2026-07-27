import Loader from '@/components/loader/Loader';

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="rounded-[28px] border border-border/70 bg-card/95 p-8 shadow-xl shadow-primary/10">
        <Loader size="md" label="Preparing your sign in form…" />
      </div>
    </div>
  );
}

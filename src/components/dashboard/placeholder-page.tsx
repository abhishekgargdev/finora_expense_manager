type PlaceholderPageProps = { title: string };

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="flex min-h-[calc(100svh-8rem)] items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-primary">{title}</p>
        <h2 className="mt-2 font-heading text-2xl font-semibold">This workspace is ready for its first view.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your {title.toLowerCase()} data and actions will appear here.
        </p>
      </div>
    </section>
  );
}

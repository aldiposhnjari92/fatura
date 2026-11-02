import type { EditorSectionProps } from '@/models/invoice';

/*
  The app's own card — `bg-card shadow-card rounded-2xl` — rather than the
  bordered `Card` primitive this used before. Settings and the dashboard are
  built that way, and two card treatments one click apart read as an accident.
  The icon chip beside the heading is the same pair the dashboard uses, and it
  is what lets a long form be scanned for the section you came back to edit.
*/
export default function EditorSection({ icon: Icon, title, hint, children }: EditorSectionProps) {
  return (
    <section className="bg-card shadow-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="bg-accent text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {hint && <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

import { SocialLinks } from "@/components/social/social-links";
import { socialProfiles } from "@/lib/social";
import { cn } from "@/lib/utils";

export function FollowEverAft({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (socialProfiles.length === 0) return null;

  return (
    <section className={cn("rounded-3xl border border-[var(--line)] bg-white/75 p-5", className)}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Follow EverAft</p>
      {compact ? null : (
        <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
          New venues, planning ideas and thoughtful finds from across the UK wedding community.
        </p>
      )}
      <SocialLinks className="mt-4" />
    </section>
  );
}

import { cn } from "@/lib/utils";
import { socialProfiles, type SocialPlatform } from "@/lib/social";

type SocialLinksProps = {
  className?: string;
  showLabels?: boolean;
  tone?: "light" | "dark";
};

export function SocialLinks({ className, showLabels = true, tone = "light" }: SocialLinksProps) {
  if (socialProfiles.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {socialProfiles.map((profile) => (
        <a
          aria-label={`Follow EverAft on ${profile.label}`}
          className={cn(
            "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-semibold transition",
            tone === "dark"
              ? "bg-white/8 text-white/80 ring-1 ring-white/15 hover:bg-white/14 hover:text-white"
              : "bg-white text-[#334235] ring-1 ring-[var(--line)] hover:bg-[#f7f1e8]"
          )}
          href={profile.href}
          key={profile.platform}
          rel="noopener noreferrer"
          target="_blank"
        >
          <SocialIcon platform={profile.platform} />
          {showLabels ? <span>{profile.label}</span> : null}
        </a>
      ))}
    </div>
  );
}

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return (
      <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <rect height="18" rx="5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" />
        <circle cx="12" cy="12" r="4.15" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.35" cy="6.7" fill="currentColor" r="1.05" />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
        <path d="M13.65 21v-8.2h2.75l.41-3.2h-3.16V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14c-.29-.04-1.3-.13-2.48-.13-2.45 0-4.13 1.49-4.13 4.24V9.6H7.56v3.2h2.77V21h3.32Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 0a12 12 0 0 0-4.37 23.18c-.1-1.86-.02-4.08.46-6.14l1.54-6.51s-.38-.77-.38-1.9c0-1.78 1.03-3.11 2.32-3.11 1.09 0 1.62.82 1.62 1.8 0 1.1-.7 2.74-1.06 4.26-.3 1.27.64 2.31 1.89 2.31 2.27 0 4.01-2.39 4.01-5.84 0-3.06-2.2-5.19-5.34-5.19-3.64 0-5.77 2.73-5.77 5.55 0 1.1.42 2.28.95 2.92.1.13.12.24.09.37l-.36 1.47c-.06.24-.19.29-.44.17-1.63-.76-2.65-3.14-2.65-5.05 0-4.11 2.99-7.89 8.61-7.89 4.52 0 8.03 3.22 8.03 7.53 0 4.49-2.83 8.1-6.75 8.1-1.32 0-2.56-.69-2.98-1.5l-.81 3.09c-.29 1.13-1.09 2.55-1.62 3.41A12 12 0 1 0 12 0Z" />
    </svg>
  );
}

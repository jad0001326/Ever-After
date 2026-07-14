export type SocialPlatform = "instagram" | "facebook" | "pinterest";

export type SocialProfile = {
  label: string;
  platform: SocialPlatform;
  href: string;
};

type ConfiguredSocialProfile = Omit<SocialProfile, "href"> & { href: string | undefined };

const configuredProfiles: ConfiguredSocialProfile[] = [
  {
    label: "Instagram",
    platform: "instagram",
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/everaftuk/"
  },
  {
    label: "Facebook",
    platform: "facebook",
    href: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "https://www.facebook.com/share/1ECMZEGUYr/"
  },
  {
    label: "Pinterest",
    platform: "pinterest",
    href: process.env.NEXT_PUBLIC_PINTEREST_URL ?? "https://pin.it/6RfmNaATp"
  }
];

function isPublicProfile(profile: ConfiguredSocialProfile): profile is SocialProfile {
  if (!profile.href) return false;

  try {
    const url = new URL(profile.href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const socialProfiles = configuredProfiles.filter(isPublicProfile);
export const socialProfileUrls = socialProfiles.map((profile) => profile.href);

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { metadata as aboutMetadata } from "@/app/about/page";
import AboutPage from "@/app/about/page";
import { metadata as businessMetadata } from "@/app/for-business/page";
import ForBusinessPage from "@/app/for-business/page";
import { metadata as loginMetadata } from "@/app/login/page";
import { metadata as signupMetadata } from "@/app/signup/page";
import { FollowEverAft } from "@/components/social/follow-everaft";

describe("public page metadata and Scotland copy", () => {
  it("gives sign-in and sign-up their own canonical pages and keeps them out of the index", () => {
    for (const [metadata, path, title] of [
      [loginMetadata, "/login", "Sign in"],
      [signupMetadata, "/signup", "Create account"]
    ] as const) {
      expect(metadata.title).toBe(title);
      expect(metadata.description).toContain("Scottish");
      expect(metadata.description).not.toContain("Discover Scottish wedding venues and photographers");
      expect(metadata.alternates).toMatchObject({ canonical: path });
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
      expect(metadata.openGraph).toMatchObject({ description: metadata.description, url: `http://localhost:3000${path}` });
    }
  });

  it("describes About and For Business as Scotland, not the wider UK", async () => {
    expect(aboutMetadata.description).toContain("across Scotland");
    expect(aboutMetadata.description).not.toMatch(/\bUK\b/);
    expect(businessMetadata.description).toContain("across Scotland");
    expect(businessMetadata.description).not.toMatch(/\bUK\b/);

    render(<AboutPage />);
    render(<FollowEverAft />);
    render(await ForBusinessPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("For Scottish wedding businesses")).toBeTruthy();
    expect(screen.getAllByText(/Scottish wedding community/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/For UK wedding businesses/)).toBeNull();
    expect(screen.queryByText(/UK wedding community/)).toBeNull();
  });
});

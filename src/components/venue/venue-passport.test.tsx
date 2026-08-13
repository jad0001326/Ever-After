import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VenuePassport } from "./venue-passport";

afterEach(cleanup);

describe("VenuePassport", () => {
  it("keeps every heritage palette above AA contrast after its quietest text opacity", () => {
    const palettes = new Map<string, { background: string; ink: string }>();

    for (let index = 0; index < 100 && palettes.size < 6; index += 1) {
      const { container, unmount } = render(
        <VenuePassport
          venue={{
            id: `venue-${index}`,
            name: `Venue ${index}`,
            region: "Scotland",
            slug: `venue-${index}`,
            town: "Edinburgh",
            type: "Castle",
          }}
        />,
      );
      const passport = container.firstElementChild as HTMLElement;
      const background = passport.style.getPropertyValue("--passport-background");
      const ink = passport.style.getPropertyValue("--passport-ink");
      palettes.set(`${background}:${ink}`, { background, ink });
      unmount();
    }

    expect(palettes.size).toBe(6);
    for (const { background, ink } of palettes.values()) {
      const quietInk = blendHex(ink, background, 0.75);
      expect(contrastRatio(quietInk, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function blendHex(foreground: string, background: string, opacity: number) {
  const front = hexChannels(foreground);
  const back = hexChannels(background);
  return front.map((channel, index) => Math.round(
    channel * opacity + back[index] * (1 - opacity),
  ));
}

function contrastRatio(foreground: number[], background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(hexChannels(background));
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function hexChannels(value: string) {
  const normalized = value.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function relativeLuminance(channels: number[]) {
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

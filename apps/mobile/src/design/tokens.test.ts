import { darkColors, lightColors, type AppColors } from "./tokens";

describe.each([
  ["light", lightColors],
  ["dark", darkColors],
] as const)("%s theme", (_name, colors) => {
  it("keeps essential text and actions at WCAG AA contrast", () => {
    expect(contrast(colors.text, colors.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textMuted, colors.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.primary, colors.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accent, colors.canvas)).toBeGreaterThanOrEqual(4.5);
  });
});

function contrast(foreground: AppColors[keyof AppColors], background: AppColors[keyof AppColors]) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g);
  if (!channels) throw new Error(`Invalid colour: ${hex}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

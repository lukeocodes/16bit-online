import type { ModelPalette } from "./types";

export function darken(c: number, a: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) * (1 - a)) | 0;
  const g = Math.max(0, ((c >> 8) & 0xff) * (1 - a)) | 0;
  const b = Math.max(0, (c & 0xff) * (1 - a)) | 0;
  return (r << 16) | (g << 8) | b;
}

export function lighten(c: number, a: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + 255 * a) | 0;
  const g = Math.min(255, ((c >> 8) & 0xff) + 255 * a) | 0;
  const b = Math.min(255, (c & 0xff) + 255 * a) | 0;
  return (r << 16) | (g << 8) | b;
}

export type ArmorType = "none" | "cloth" | "leather" | "mail" | "plate";

/**
 * Compute the full model palette from base character colors + armor type.
 * The body/accent/outline colors change based on what armor is worn.
 */
export function computePalette(
  skin: number,
  hair: number,
  eyes: number,
  primary: number,
  secondary: number,
  armor: ArmorType
): ModelPalette {
  const base = { skin, hair, eyes, primary, secondary };
  switch (armor) {
    case "none":
      return {
        ...base,
        body: skin,
        bodyDk: darken(skin, 0.2),
        bodyLt: lighten(skin, 0.1),
        accent: darken(skin, 0.15),
        accentDk: darken(skin, 0.3),
        outline: darken(skin, 0.35),
      };
    case "cloth":
      return {
        ...base,
        body: primary,
        bodyDk: darken(primary, 0.2),
        bodyLt: lighten(primary, 0.12),
        accent: secondary,
        accentDk: darken(secondary, 0.25),
        outline: darken(primary, 0.45),
      };
    case "leather":
      return {
        ...base,
        body: 0x8b6914,
        bodyDk: 0x6b4e0e,
        bodyLt: 0xa07b1a,
        accent: 0x5c4510,
        accentDk: 0x3d2e0a,
        outline: 0x3a2a08,
      };
    case "mail":
      return {
        ...base,
        body: 0x8888a0,
        bodyDk: 0x666680,
        bodyLt: 0xa0a0b8,
        accent: 0x6b4e12,
        accentDk: 0x4a350c,
        outline: 0x44445a,
      };
    case "plate":
      return {
        ...base,
        body: 0xaab0c0,
        bodyDk: 0x7880a0,
        bodyLt: 0xc8d0e0,
        accent: 0x8890a8,
        accentDk: 0x606880,
        outline: 0x505868,
      };
  }
}

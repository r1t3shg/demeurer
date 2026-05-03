/**
 * Provides the merchant's live theme tokens to nested editor components
 * (Properties panel field renderers in particular). The Canvas already
 * receives tokens via prop; the inspector reaches them via context so
 * field components don't need every parent to thread them through.
 */

import { createContext, useContext } from "react";

import type { ThemeTokens } from "../../lib/sections";

const FALLBACK: ThemeTokens = {
  colors: {
    background: "#ffffff",
    text: "#1a1a1a",
    accent: "#1a73e8",
  },
  typography: {
    headingFont: "Georgia, serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    scale: 1,
  },
  spacing: { unit: 8 },
};

export const ThemeTokensContext = createContext<ThemeTokens>(FALLBACK);

export function useThemeTokens(): ThemeTokens {
  return useContext(ThemeTokensContext);
}

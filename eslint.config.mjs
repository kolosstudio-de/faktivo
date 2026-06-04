import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test-Skripte sind plain Node, kein React — eslint-react-hooks
    // generiert hier false-positives für react-pdf-Imports.
    "scripts/**",
  ]),
  {
    // React 19's `react-hooks/set-state-in-effect` blockt legitimes
    // "lese externen State (localStorage / cookie / supabase-cache) bei
    // mount" Pattern. Wir nutzen das durchgängig:
    //   - theme-provider.tsx (Theme aus localStorage)
    //   - use-display-prefs.ts (UI-Pref aus localStorage)
    //   - login-form.tsx (Rate-Limit-Status pro Email)
    //   - mahnung-dialog.tsx, finalize-confirm-dialog.tsx, etc.
    //
    // Diese Effects sind SSR-safe (typeof-window-checks) und feuern nur
    // einmal pro Mount oder bei genau definierter dep-change.
    //
    // React 19 empfiehlt für solche Fälle `useSyncExternalStore`. Das ist
    // ein eigener Refactor (~halber Tag pro Datei); bis dahin akzeptieren
    // wir das Pattern explizit. Sobald der Refactor durch ist, diese
    // Override entfernen und `continue-on-error: true` aus ci.yml
    // entfernen.
    //
    // Stand 2026-06-04
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

---
name: payqr-mobile
description: Implement PayQR screens, navigation, camera OCR, and payment app shortcuts with the project's Expo and platform boundaries.
---

# PayQR mobile development

Read root AGENTS.md and package.json first. Before touching Expo, React Native, or EAS APIs, fetch the installed Expo major's versioned docs. For other Expo topics, start at https://docs.expo.dev/llms.txt and follow the relevant page. Recheck the installed SDK rather than freezing this skill to a version.

## Source map

- src/app/: Expo Router route wrappers and layouts; keep reusable code outside this directory.
- src/screens/: screen behavior, shared controls, bottom sheets, footer insets, and feedback.
- src/domain/: platform-independent validation and state operations.
- src/services/: platform adapters; inspect matching .web.ts implementations when changing native behavior.
- modules/payqr-ocr/ and modules/payqr-launcher/: maintained local native modules. Root android/ and ios/ are generated; configure them through app configuration or plugins.

Preserve keyboard avoidance, safe-area footer placement, accessible icon labels, and Android Back/dismiss behavior. Avoid unnecessary camera work: release previews during recognition and backgrounding, and clean temporary captures on success, failure, and cancellation.

OCR and installed-app discovery require a native development build. Preserve manual number entry and web/iOS fallbacks. Normalize complete numbers through existing domain functions; keep partial editing separate from complete-number validation. Copy before opening a payment app, and do not append numbers or amounts to launch targets.

Use the package manager selected by the lockfile; add dependencies with Expo's SDK resolver. Run npm run lint and npm run typecheck (or the corresponding Bun commands). For changed behavior, run the relevant screen/service tests in __tests__. Report which platforms were actually exercised and which need a device check.

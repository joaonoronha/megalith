# Animated Multilingual Wedding Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a luxurious, mobile-first, animated multilingual wedding invitation website for Madalena & João celebrating their wedding at Quinta da Grilla, Portugal on 16 August 2027.

**Architecture:** Standalone product under `apps/wedding/` with frontend service `apps/wedding/web/`. Clean separation of immutable wedding facts, typed i18n with European Portuguese (`pt-PT`) as canonical source of truth (plus English and French translations), original layered SVG illustrations, and declarative `motion` entrance choreography with native document scrolling.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, `@testing-library/react`, `motion` (Motion for React 12), CSS tokens.

**Spec:** [`docs/superpowers/specs/2026-10-13-wedding-invitation-design.md`](file:///workspaces/megalith/docs/superpowers/specs/2026-10-13-wedding-invitation-design.md)

## Global Constraints

- **Product Location:** `apps/wedding` (web service at `apps/wedding/web`); zero edits to `apps/demo`.
- **Root Catalog:** Registered in `projects.yaml` under `products:`; passes `python3 tooling/validate.py`.
- **Canonical Locale:** `pt-PT` (European Portuguese, mandatory, elegant wedding register, strictly no Brazilian Portuguese vocabulary or syntax).
- **Other Locales:** `en` (English) and `fr` (French) with 100% translation key parity.
- **Event Instant:** `2027-08-16T15:00:00Z` (`2027-08-16T16:00:00` in Europe/Lisbon).
- **Original Assets:** 100% original SVG and styling; no proprietary assets extracted from reference.
- **Accessibility:** Semantic HTML, `prefers-reduced-motion` support, `aria-hidden="true"` on decorative SVGs.
- **Cost:** €0/month recurring cost; no cloud dependencies, paid animation libraries, or external APIs.
- **HARD OPERATOR REVIEW GATE AT CHECKPOINT B:** Stop execution and report with mobile/desktop screenshots before implementing Checkpoint C (Countdown & Venue).

## Review Focus

1. **Locale subtag normalization (`navigator.languages`):** Handling variations like `pt-BR`, `PT-pt`, `en-US`, `fr-BE`, or empty array without crashing or defaulting to wrong copy.
2. **Reduced motion override:** Users with `prefers-reduced-motion: reduce` must see the complete hero layout immediately without animation delay or blank screen.
3. **Narrow mobile viewport layout (375px–430px):** Long Portuguese headings and names must not clip, wrap awkwardly, or cause horizontal scroll overflow.
4. **Countdown past-event arithmetic:** Ensuring countdown does not show negative values if opened after 16 August 2027.
5. **Language change during hero animation:** Switching between PT, EN, and FR must update copy smoothly without resetting animation timeline or scrolling jump.

---

### Task 1: Product Scaffolding & Manifests (Checkpoint A)

**Files:**
- Create: `apps/wedding/product.yaml`
- Create: `apps/wedding/README.md`
- Create: `apps/wedding/web/service.yaml`
- Create: `apps/wedding/web/package.json`
- Create: `apps/wedding/web/vite.config.ts`
- Create: `apps/wedding/web/tsconfig.json`
- Create: `apps/wedding/web/index.html`
- Create: `apps/wedding/web/src/main.tsx`
- Create: `apps/wedding/web/src/setupTests.ts`
- Modify: `projects.yaml:14-17`
- Test: `tooling/validate.py`

**Interfaces:**
- Produces: Valid Megalith product and web service manifests passing monorepo validation.

- [ ] **Step 1: Write product and service manifests**
  - Add `wedding` entry to `projects.yaml`.
  - Create `apps/wedding/product.yaml` and `apps/wedding/README.md`.
  - Create `apps/wedding/web/service.yaml` with port `8080`, dev port `5174`, and standard lifecycle commands.
- [ ] **Step 2: Run monorepo validator**
  Run: `python3 tooling/validate.py`
  Expected: PASS with 2 products found.
- [ ] **Step 3: Setup `apps/wedding/web` toolchain**
  - Create `package.json` with React 19, TypeScript, Vite 6, Vitest, `@testing-library/react`, and `motion`.
  - Create `vite.config.ts`, `tsconfig.json`, `index.html`, and `src/setupTests.ts`.
  - Install dependencies via `pnpm --dir apps/wedding/web install`.
- [ ] **Step 4: Verify build and test runner**
  Run: `pnpm --dir apps/wedding/web run build`
  Expected: Build succeeds.
- [ ] **Step 5: Commit**
  ```bash
  git add projects.yaml apps/wedding/
  git commit -m "feat(wedding): scaffold wedding product and web service manifests"
  ```

---

### Task 2: Config, Types, and Internationalization Engine (Checkpoint A)

**Files:**
- Create: `apps/wedding/web/src/config/wedding.ts`
- Create: `apps/wedding/web/src/i18n/types.ts`
- Create: `apps/wedding/web/src/i18n/translations/pt-PT.ts`
- Create: `apps/wedding/web/src/i18n/translations/en.ts`
- Create: `apps/wedding/web/src/i18n/translations/fr.ts`
- Create: `apps/wedding/web/src/i18n/detectLanguage.ts`
- Create: `apps/wedding/web/src/i18n/index.tsx`
- Test: `apps/wedding/web/tests/i18n.test.ts`

**Interfaces:**
- Produces:
  - `WEDDING_CONFIG`: immutable facts object.
  - `SUPPORTED_LOCALES`: `['pt-PT', 'en', 'fr'] as const`.
  - `detectLanguage(stored?: string | null, nav?: Navigator): Locale`.
  - `I18nProvider`, `useI18n()` hook exposing `{ locale, t, setLocale }`.

- [ ] **Step 1: Write failing i18n unit tests**
  - Test browser detection preference ordering: `['fr-FR', 'en-US']` -> `'fr'`, `['en-GB']` -> `'en'`, `['pt-BR']` -> `'pt-PT'`.
  - Test unsupported locales (`['de-DE']`, `['es-ES']`, `[]`) -> fallback `'pt-PT'`.
  - Test stored preference priority over browser headers.
  - Test 100% translation key symmetry between `pt-PT`, `en`, and `fr`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/i18n.test.ts`
  Expected: FAIL with missing modules.
- [ ] **Step 3: Implement config, typed translations, and `detectLanguage`**
  - Create `wedding.ts` with canonical event facts (`2027-08-16T15:00:00Z`).
  - Create `types.ts` with strict schema.
  - Create `pt-PT.ts`, `en.ts`, and `fr.ts` matching editorial copy.
  - Create `detectLanguage.ts` and `I18nProvider` in `index.tsx`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/i18n.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/config/ apps/wedding/web/src/i18n/ apps/wedding/web/tests/i18n.test.ts
  git commit -m "feat(wedding): implement wedding configuration and typed i18n engine"
  ```

---

### Task 3: Discreet Language Switcher Component (Checkpoint A)

**Files:**
- Create: `apps/wedding/web/src/components/LanguageSwitcher.tsx`
- Create: `apps/wedding/web/src/styles/tokens.css`
- Create: `apps/wedding/web/src/styles/global.css`
- Test: `apps/wedding/web/tests/LanguageSwitcher.test.tsx`

**Interfaces:**
- Produces: `<LanguageSwitcher />` component rendering `PT · EN · FR` buttons.
- Consumes: `useI18n()` from `src/i18n`.

- [ ] **Step 1: Write failing LanguageSwitcher test**
  - Test rendering `PT · EN · FR`.
  - Test active locale highlighting and `aria-pressed="true"`.
  - Test clicking changes active locale in context and updates `document.documentElement.lang`.
  - Test persistence to `localStorage`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/LanguageSwitcher.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement `LanguageSwitcher` and CSS tokens**
  - Create `tokens.css` with palette variables (`--color-ivory: #F5F2EB`, `--color-olive: #505B46`, `--color-sage: #A7B09A`, `--color-gold: #A3894F`, `--color-border: #D5D7C6`).
  - Implement `LanguageSwitcher.tsx` with accessible button elements.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/LanguageSwitcher.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/components/LanguageSwitcher.tsx apps/wedding/web/src/styles/ apps/wedding/web/tests/LanguageSwitcher.test.tsx
  git commit -m "feat(wedding): implement language switcher component and design tokens"
  ```

---

### Task 4: Original SVG Botanical Canopy & Paper Texture (Checkpoint B)

**Files:**
- Create: `apps/wedding/web/src/components/BotanicalFrame.tsx`
- Create: `apps/wedding/web/src/components/PaperTexture.tsx`
- Test: `apps/wedding/web/tests/BotanicalFrame.test.tsx`

**Interfaces:**
- Produces:
  - `<BotanicalFrame isVisible?: boolean />` rendering left and right cascading foliage with veined olive leaves.
  - `<PaperTexture />` rendering static linen grain SVG overlay (`aria-hidden="true"`).

- [ ] **Step 1: Write BotanicalFrame and PaperTexture test**
  - Verify SVGs render with `aria-hidden="true"`.
  - Verify responsive SVG viewboxes and classes.
  - Verify reduced motion bypasses transforms.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/BotanicalFrame.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement BotanicalFrame and PaperTexture**
  - Handcrafted SVG branches with asymmetrical olive leaves, stems, and leaf vein details.
  - Subtle noise grain filter overlay without expensive runtime animated filters.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/BotanicalFrame.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/components/BotanicalFrame.tsx apps/wedding/web/src/components/PaperTexture.tsx apps/wedding/web/tests/BotanicalFrame.test.tsx
  git commit -m "feat(wedding): create bespoke SVG botanical canopy and paper texture"
  ```

---

### Task 5: Original Chandelier & Reception Table Illustrations (Checkpoint B)

**Files:**
- Create: `apps/wedding/web/src/components/Chandelier.tsx`
- Create: `apps/wedding/web/src/components/ReceptionIllustration.tsx`
- Test: `apps/wedding/web/tests/Illustrations.test.tsx`

**Interfaces:**
- Produces:
  - `<Chandelier />`: Antique gold SVG chandelier with crystals and candle motifs.
  - `<ReceptionIllustration />`: Wide banquet table anchoring bottom hero with ivory runner, brass holders, tapers, and eucalyptus garlands.

- [ ] **Step 1: Write illustrations test**
  - Test SVG elements have `aria-hidden="true"`.
  - Test responsive layout attributes.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/Illustrations.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement Chandelier and ReceptionIllustration**
  - Chandelier with delicate gold lines (`#A3894F`) and soft ambient glow.
  - Banquet table with ivory linen folds, candles, stemware, and botanical greenery.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/Illustrations.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/components/Chandelier.tsx apps/wedding/web/src/components/ReceptionIllustration.tsx apps/wedding/web/tests/Illustrations.test.tsx
  git commit -m "feat(wedding): create bespoke chandelier and reception table illustrations"
  ```

---

### Task 6: Hero Layout & Staggered Reveal Animation Choreography (Checkpoint B — Hard Review Gate)

**Files:**
- Create: `apps/wedding/web/src/components/AnimatedInvitationText.tsx`
- Create: `apps/wedding/web/src/components/InvitationHero.tsx`
- Create: `apps/wedding/web/src/styles/invitation.css`
- Modify: `apps/wedding/web/src/App.tsx`
- Test: `apps/wedding/web/tests/InvitationHero.test.tsx`

**Interfaces:**
- Produces: Full hero view with sequenced motion reveal, responsive mobile & desktop typography.

- [ ] **Step 1: Write hero integration tests**
  - Test hero renders eyebrow, couple names ("Madalena & João"), date ("16 de agosto de 2027"), venue ("Quinta da Grilla"), and invitation message.
  - Test dynamic copy update when language changes.
  - Test `prefers-reduced-motion` suppresses animation delays.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/InvitationHero.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement `AnimatedInvitationText`, `InvitationHero`, and `App.tsx`**
  - Orchestrate sequence: Background -> Botanical canopy -> Chandelier -> Eyebrow -> Names -> Divider -> Date/Venue/Message -> Reception table.
  - Use cubic-bezier easing `[0.22, 1, 0.36, 1]`.
  - Mobile-first responsive styling in `invitation.css`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/InvitationHero.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Capture mobile (PT, EN, FR) and desktop screenshots**
  - Run preview server and use headless browser / script to capture viewport screenshots at 390px and 1280px.
- [ ] **Step 6: Commit & PRESENT CHECKPOINT B REPORT**
  ```bash
  git add apps/wedding/web/src/ apps/wedding/web/tests/InvitationHero.test.tsx
  git commit -m "feat(wedding): complete animated hero invitation sequence"
  ```
  - **STOP EXECUTION:** Present Checkpoint B report with screenshots for operator visual review before starting Task 7.

---

### Task 7: Wedding Countdown Card & Arithmetic (Checkpoint C)

**Files:**
- Create: `apps/wedding/web/src/components/WeddingCountdown.tsx`
- Create: `apps/wedding/web/src/utils/countdown.ts`
- Test: `apps/wedding/web/tests/countdown.test.ts`
- Test: `apps/wedding/web/tests/WeddingCountdown.test.tsx`

**Interfaces:**
- Produces:
  - `calculateCountdown(targetUtc: string, now: Date): { days, hours, minutes, seconds, isPast }`
  - `<WeddingCountdown />` with fine double border, gold diamond accent, and polite aria live region.

- [ ] **Step 1: Write failing countdown arithmetic tests**
  - Test accurate difference against `2027-08-16T15:00:00Z`.
  - Test zeroed state when target date is reached or passed.
  - Test interval cleanup on component unmount.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/countdown.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement countdown calculation and component**
  - Timezone-safe UTC subtraction.
  - Tabular numeric typography with translated units ("dias", "horas", "minutos", "segundos").
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/countdown.test.ts tests/WeddingCountdown.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/components/WeddingCountdown.tsx apps/wedding/web/src/utils/countdown.ts apps/wedding/web/tests/countdown*
  git commit -m "feat(wedding): implement timezone-safe wedding countdown card"
  ```

---

### Task 8: Venue Section & External Links (Checkpoint C)

**Files:**
- Create: `apps/wedding/web/src/components/VenueSection.tsx`
- Test: `apps/wedding/web/tests/VenueSection.test.tsx`

**Interfaces:**
- Produces: `<VenueSection />` displaying Quinta da Grilla, country, date/time, and official external link.

- [ ] **Step 1: Write VenueSection unit test**
  - Verify heading, venue name "Quinta da Grilla", and translated link "Ver o local" / "View the venue" / "Découvrir le lieu".
  - Verify external link has `href="https://quintadagrilla.com"`, `target="_blank"`, and `rel="noopener noreferrer"`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/VenueSection.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement `VenueSection.tsx`**
  - Arched border framing with refined typography and understated botanical sprigs.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/VenueSection.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/components/VenueSection.tsx apps/wedding/web/tests/VenueSection.test.tsx
  git commit -m "feat(wedding): implement venue section for Quinta da Grilla"
  ```

---

### Task 9: Natural Scroll Progression & Accessibility Polish (Checkpoint C)

**Files:**
- Modify: `apps/wedding/web/src/App.tsx`
- Modify: `apps/wedding/web/src/styles/invitation.css`
- Test: `apps/wedding/web/tests/App.test.tsx`

**Interfaces:**
- Produces: Fully integrated single-page document scrolling smoothly from Hero to Countdown to Venue without scroll-jacking.

- [ ] **Step 1: Write App integration test**
  - Test all sections render in correct document order.
  - Test page scroll behavior is natural and without forced locking.
  - Test document `lang` matches active locale.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --dir apps/wedding/web test tests/App.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Integrate sections in `App.tsx` and refine styles**
  - Hero -> Countdown -> Venue -> Footer with delicate diamond divider.
  - Viewport-triggered subtle reveal for Countdown and Venue cards.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --dir apps/wedding/web test tests/App.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add apps/wedding/web/src/App.tsx apps/wedding/web/src/styles/ apps/wedding/web/tests/App.test.tsx
  git commit -m "feat(wedding): integrate natural scroll progression and accessibility polish"
  ```

---

### Task 10: Final Verification, Screenshots & PR Preparation (Checkpoint D)

**Files:**
- Verify: Full test suite in `apps/wedding/web`
- Verify: `python3 tooling/validate.py`
- Verify: `pnpm --dir apps/demo/web test` (ensure demo has zero regressions)
- Create: PR description and summary

- [ ] **Step 1: Run complete wedding frontend test suite**
  Run: `pnpm --dir apps/wedding/web test`
  Expected: All tests PASS.
- [ ] **Step 2: Run monorepo validation & tooling tests**
  Run: `python3 tooling/validate.py && pytest tooling/tests`
  Expected: All manifests and contracts valid, all tests PASS.
- [ ] **Step 3: Run existing demo frontend tests**
  Run: `pnpm --dir apps/demo/web test`
  Expected: All demo tests PASS (zero regression).
- [ ] **Step 4: Capture final responsive screenshots**
  - 375px mobile, 430px mobile, 1280px desktop.
- [ ] **Step 5: Prepare pull request draft**
  - Generate comprehensive PR documentation with asset inventory, animation timings, test results, and visual comparison.

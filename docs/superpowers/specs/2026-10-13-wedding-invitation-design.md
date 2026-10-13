# Design Specification: Task W001 — Animated Multilingual Wedding Invitation

**Date:** 2026-10-13  
**Status:** Approved  
**Author:** Agy (Senior React/TypeScript Engineer, Motion Designer and Frontend Architect)  
**Governance:** ADR-013 — Cooperatively Enforced, Operator-Reviewed  
**Target Product:** `apps/wedding` (`web` service: `apps/wedding/web`)  

---

## 1. Overview & Goal

The objective is to implement a luxury, mobile-first, animated wedding invitation web application for Madalena & João celebrating their wedding at Quinta da Grilla, Portugal on Monday, 16 August 2027 at 16h00 (Europe/Lisbon).

The experience is inspired by the Invite Atelier botanical editorial design language, recreated using 100% original bespoke SVG artwork, fluid React 19 motion choreography, European Portuguese as the canonical source-of-truth locale (with English and French translations), and full integration within the Megalith product-oriented monorepo architecture (`projects.yaml`).

---

## 2. Monorepo Integration & Product Architecture

1. **Product Isolation:**
   * Declared as a standalone product under `apps/wedding/`.
   * Manifest `apps/wedding/product.yaml` with metadata and registered services.
   * Documentation `apps/wedding/README.md`.
   * Root registration in `projects.yaml` under `products:`.
   * Service manifest `apps/wedding/web/service.yaml` specifying `port: 8080`, dev port `5174`, and standard lifecycle commands.
   * Complete isolation from `apps/demo/web`: no shared code or modifications to demo files.
   * Full conformance with `python3 tooling/validate.py`.

2. **Frontend Service Toolchain (`apps/wedding/web`):**
   * **Runtime:** React 19 (`react`, `react-dom`).
   * **Language:** TypeScript 5.7+ with strict typing.
   * **Bundler & Dev Server:** Vite 6.
   * **Motion Engine:** `motion` (Motion for React 12, official React 19-compatible release).
   * **Testing:** Vitest 3, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
   * **Styling:** CSS tokens (`tokens.css`), responsive layouts (`invitation.css`), and self-contained SVG styling.

---

## 3. Confirmed Wedding Facts & Data Model

The application isolates confirmed immutable event facts from presentation and translation logic in `apps/wedding/web/src/config/wedding.ts`:

* **Bride:** Madalena
* **Groom:** João
* **Couple Display Name:** Madalena & João
* **Wedding Date:** Monday, 16 August 2027
* **Wedding Local Time:** 16h00
* **Timezone:** Europe/Lisbon (`2027-08-16T16:00:00+01:00`)
* **Canonical UTC Event Instant:** `2027-08-16T15:00:00Z`
* **Venue Name:** Quinta da Grilla
* **Official Venue Website:** `https://quintadagrilla.com`
* **Venue Country:** Portugal

No unconfirmed facts (e.g. dress code, guest arrival time, ceremony schedule, accommodation, transport) are assumed or rendered.

---

## 4. Internationalization (i18n) Architecture

### 4.1 Supported Locales
* `pt-PT`: Português de Portugal (**Canonical and Mandatory**; formal and celebratory wedding register, strictly no Brazilian vocabulary, grammar, or phrasing).
* `en`: English (refined celebratory wedding register).
* `fr`: Français (refined celebratory wedding register).

### 4.2 Translation Schema & Symmetry
A typed interface `TranslationSchema` enforces 100% key parity across `pt-PT.ts`, `en.ts`, and `fr.ts`:
* `eyebrow`: "O NOSSO CASAMENTO" / "OUR WEDDING" / "NOTRE MARIAGE"
* `names`: "Madalena & João"
* `invitation`: "É com muita alegria que vos convidamos a celebrar connosco o nosso casamento." / "We are delighted to invite you to celebrate our wedding with us." / "C'est avec une immense joie que nous vous invitons à célébrer notre mariage à nos côtés."
* `date`: "16 de agosto de 2027" / "16 August 2027" / "16 août 2027"
* `time`: "16h00" / "4:00 PM" / "16h00"
* `countdownHeading`: "Faltam apenas..." / "Counting down..." / "Le compte à rebours..."
* `countdownUnits`: `{ days: "dias", hours: "horas", minutes: "minutos", seconds: "segundos" }`
* `venueHeading`: "O local" / "The venue" / "Le lieu"
* `venueName`: "Quinta da Grilla"
* `venueLink`: "Ver o local" / "View the venue" / "Découvrir le lieu"
* `a11y`: Accessible labels for language switching, countdown updates, and venue navigation.

### 4.3 Browser Language Detection & Fallback
Implemented client-side in `detectLanguage.ts`:
1. Check `localStorage.getItem('wedding_lang')`. If valid (`pt-PT`, `en`, `fr`), return it.
2. Inspect `navigator.languages` (falling back to `navigator.language`):
   * `pt*` (including `pt-BR`, `pt-PT`, `pt`) -> `pt-PT` (European Portuguese content).
   * `en*` -> `en`.
   * `fr*` -> `fr`.
   * Unsupported (e.g. `de-DE`, `es-ES`, or empty) -> `pt-PT`.
3. Synchronize `document.documentElement.lang` upon initialization and updates.

### 4.4 Discreet Language Selector (`LanguageSwitcher.tsx`)
* Positioned in the upper-right corner with safe-area padding (`env(safe-area-inset-top)`).
* Formatted as `PT · EN · FR` with accessible active states (`aria-pressed`, `aria-label`).
* Persists user choice in `localStorage`.
* Updates state without page reload, avoiding hero animation restarts.

---

## 5. Visual Art Direction & Original Artwork

### 5.1 Color Palette & Design Tokens
* Warm ivory background: `#F5F2EB`
* Deep olive typography: `#505B46`
* Muted sage foliage: `#A7B09A`
* Antique gold accents: `#A3894F`
* Subtle linen borders: `#D5D7C6`
* Secondary warm gray: `#716A54`

### 5.2 Bespoke Original SVG Assets
* **`BotanicalFrame.tsx`**: Organic olive and sage botanical branches hanging from upper-left and upper-right corners. Includes varied leaf silhouettes, leaf veins, and subtle depth layers (`aria-hidden="true"`).
* **`Chandelier.tsx`**: Delicate antique gold chandelier with ornamental tiers, candle drops, crystal accents, and gentle ambient idle sway (`aria-hidden="true"`).
* **`ReceptionIllustration.tsx`**: Wide banquet table anchoring the hero bottom with draped ivory linen runner, brass taper candleholders, glassware, and olive sprig garlands (`aria-hidden="true"`).
* **`PaperTexture`**: Subtle SVG noise texture overlay simulating cotton invitation paper.

---

## 6. Motion & Scroll Choreography

### 6.1 Hero Entrance Sequence
Total sequence duration: ~2.5–3.0 seconds, using ease `[0.22, 1, 0.36, 1]`:
1. **0.0s**: Warm ivory background and paper texture immediately rendered.
2. **0.2s–0.4s**: Botanical canopy fades in with slight downward translation (`y: -20px -> 0px`).
3. **0.7s**: Chandelier descends smoothly into position.
4. **1.1s**: Eyebrow ("O NOSSO CASAMENTO") fades in with letter-spacing settling.
5. **1.4s–1.7s**: Couple names ("Madalena" & "João") reveal with staggered vertical slide and opacity.
6. **2.0s**: Thin gold divider line expands (`scaleX: 0 -> 1`) with diamond motif.
7. **2.3s**: Date, time, venue, and invitation text fade into place.
8. **2.6s**: Reception table illustration rises gently into anchor position.

### 6.2 Reduced Motion Mode
When `prefers-reduced-motion` is active, all transforms, staggers, and delays are bypassed (`transition: { duration: 0 }`), displaying complete layout instantly.

### 6.3 Scroll Progression
* Natural document scrolling without scroll-jacking or fixed locks.
* As the user scrolls past the hero, the reception table naturally leaves the viewport.
* The countdown card reveals gracefully via viewport intersection.
* The venue section follows with Quinta da Grilla links and details.

---

## 7. Countdown & Venue Sections

1. **Countdown Section (`WeddingCountdown.tsx`):**
   * Fine double-bordered card (`#A3894F/50` outer, `#D5D7C6` inner) with botanical sprig accents.
   * Time calculation derived from target `2027-08-16T15:00:00Z`.
   * Grid display of Days, Hours, Minutes, Seconds with `tabular-nums` alignment.
   * `aria-live="polite"` with polite time announcement to prevent continuous screen-reader noise.
   * Interval timer cleanup on unmount.
   * Graceful zeroed state if target date has passed.

2. **Venue Section (`VenueSection.tsx`):**
   * Elegant heading ("O local" / "The venue" / "Le lieu").
   * Quinta da Grilla branding, date, and local time.
   * Official external link (`https://quintadagrilla.com`) with secure rel attributes (`noopener noreferrer`).
   * Clean responsive layout adaptable for future photo additions.

---

## 8. Verification & Checkpoint Strategy

* **Checkpoint A (Product Scaffold):**
  * Scaffold directory structure and manifest files.
  * Install dependencies and configure toolchain.
  * Implement typed config, i18n, detection, and basic unit tests.
  * Run `python3 tooling/validate.py` and test suite.

* **Checkpoint B (Visual Hero & Visual Review):**
  * Implement original botanical canopy, chandelier, reception table, typography, and motion orchestration.
  * Implement responsive mobile layout (375px–430px) and desktop layout.
  * Capture screenshots of mobile hero in `pt-PT`, `en`, and `fr`, plus desktop.
  * **STOP AT CHECKPOINT B** for operator review.

* **Checkpoint C (Remaining Sections):**
  * Implement Countdown, VenueSection, scroll transitions, and accessibility polish.

* **Checkpoint D (Final Verification & PR Preparation):**
  * Comprehensive test runs, git branch creation, PR draft preparation.

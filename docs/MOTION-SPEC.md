# BuybackAI — Motion Design Specification

## Overview
A unified motion system for the BuybackAI SaaS — landing, auth, onboarding, audit, dashboard, agents. The product sells "buying back time," so motion must feel **calm, deliberate, and confident**: never frantic, never decorative. Motion communicates state changes (an agent took an action), not personality.

## Design Principles

- **Calm beats clever.** The user is overwhelmed and considering paying us to slow life down. Motion that wiggles, bounces, or attention-seeks contradicts the pitch. Default easing is `cubic-bezier(0.16, 1, 0.3, 1)` (Apple's standard ease-out) — fast start, gentle settle.
- **Editorial, not playful.** This is the "Anthropic-meets-Stripe-docs" register: hairlines, monospace labels, serif pull-quotes. Motion respects that — short translations, opacity over scale, no gratuitous parallax.
- **State, not decoration.** Every animation answers a question: did it work? where did the data come from? what changed? If it doesn't answer one of those, it gets cut.
- **Stagger to imply causality.** When multiple elements enter, stagger 60–80ms to suggest *this caused that* — list items, agent cards, audit rows.
- **Reduced motion is a first-class state, not a fallback.** With `prefers-reduced-motion: reduce` we collapse all transforms to opacity-only and shorten durations to 120ms.
- **The accent (`#d4ff3a`) is the only color that pulses.** Everything else holds still. The pulse means *active, working, fresh* — never used decoratively.

## Timing & Easing — global tokens

| Token | Value | Use |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default for entrances, hovers, page transitions |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits — fast acceleration off-screen |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Reserved for "agent took action" confirmations only — slight overshoot |
| `--ease-linear` | `linear` | Pulse loops, progress bars |
| `--dur-instant` | `120ms` | Hover, focus, tap feedback |
| `--dur-quick` | `220ms` | Micro UI: dropdowns, popovers, button states |
| `--dur-base` | `380ms` | Section reveals, card entrances |
| `--dur-slow` | `680ms` | Hero entrance, audit-result reveal |
| `--dur-pulse` | `2400ms` | Live-status pulse loop |
| `--stagger` | `70ms` | Default child stagger |

## Motion vocabulary (per surface)

### 1. Landing page (`/`)

**Hero** — left column slides up 14px + fades in over 680ms. Right column (audit-result card) starts at `opacity: 0; translateY(24px)`, animates in 80ms after the headline finishes its first 60% (so they don't fight for attention).

**Pull-quote** — fades in (no transform) when 30% in viewport. Slow: 800ms.

**Section eyebrows** — typewriter-style char-by-char reveal at 28ms/char on first viewport entry. One time only.

**Live-status dot** (`.pulse-soft`) — opacity loop 0.5 → 1 → 0.5 over 2400ms, linear. Never stops.

**Agent cards** (3-card row) — staggered entrance 70ms each, translateY(16px) + opacity. On hover: hairline border brightens from `rgba(255,255,255,0.06)` to `rgba(255,255,255,0.14)` over 120ms; price chip scales 1 → 1.02 over 220ms (subtle, not bouncy).

**CTA buttons** — hover: background lightens 8% over 120ms. Active (mousedown): scale 0.98 over 80ms.

**Audit-result card** in hero — numbers tween in via `requestAnimationFrame` counter from 0 to target value over 1200ms with `ease-out`. Dollar values format with thousands separators as they tick.

### 2. Auth (`/auth/login`, `/auth/signup`)

**Form entrance** — single fade-up 380ms. No stagger; auth should feel terminal, not theatrical.

**Submit state** — button text crossfades to spinner (a single rotating hairline ring, 800ms linear loop). On success, button background shifts to accent and ✓ scales in via spring (0.34, 1.4, 0.64, 1) for 380ms, then route transition.

**Error shake** — 4px horizontal translate, 3 cycles, 60ms each, ease-out. Red border fades over 220ms.

### 3. Onboarding (`/onboarding`)

**Step transitions** — current step slides out left (-24px, 220ms ease-in), next step slides in from right (+24px → 0, 380ms ease-out, 60ms delay).

**Master-prompt generation** — token-streaming reveal: each token appended with opacity 0 → 1 over 80ms. Cursor blinks at `1Hz` while streaming. When complete, the cursor fades out over 220ms.

**Progress bar** — width tweens linear, no spring. Width is bound to `currentStep / totalSteps`; transitions `width 380ms cubic-bezier(0.16, 1, 0.3, 1)`.

### 4. Audit (`/audit`)

The audit is the product's "wow moment." It deserves the most motion budget.

**Connecting state** — terminal-style log lines append every 240–600ms (jittered to feel real, not metronomic). Each line: opacity 0 → 1 over 120ms + cursor advance.

**Categorizing** — accent shimmer travels left-to-right across the row being processed. 1200ms linear loop. Stops when row completes; checkmark scales in 220ms ease-spring.

**Reveal of results** — once categorization completes, the result card's blur drops (`backdrop-filter: blur(20px) → blur(0)`) over 680ms while the underlying numbers animate up from 0 in parallel.

**Recoverable dollar amount** — animates last (200ms after rows complete), counter from 0 → target over 1400ms, ease-out. Color: `#d4ff3a`. Subtle pulse (opacity 0.85 → 1 → 0.85) loops 3 times then settles.

### 5. Dashboard (`/dashboard`)

**Agent cards (deployed)** — entrance staggered 70ms. Each card has a "live" indicator (pulse dot) and a metrics row (hours saved, tasks completed) that ticks up with each successful cron run.

**Action queue (drafts waiting)** — new items push in from top, existing items translate down. Use FLIP (First-Last-Invert-Play): measure before, measure after, animate the delta. 380ms ease-out, max 6 simultaneous animations.

**Approve / dismiss** — approve: row glows accent for 220ms, then height collapses to 0 over 380ms ease-in, padding/margin collapse with it. Dismiss: same height collapse but no glow.

**Empty states** — center-aligned, 1.0 opacity, no animation on entrance (it's an absence, not an arrival).

**Real-time notification** ("Inbox Ivy drafted 3 replies") — toast slides up from bottom-right, +20px → 0, 380ms ease-out. Auto-dismiss after 4.8s with 220ms ease-in slide-down + fade.

### 6. Agents marketplace (`/agents`)

**Card grid** — 3-column, staggered diagonal entrance: row 1 left-to-right (70ms stagger), row 2 60ms after row 1 finishes.

**Hover state** — card lifts via `translateY(-2px)` + `box-shadow` deepens over 220ms ease-out. Hairline brightens. Inner "deploy" CTA fades in (it's hidden until hover) over 220ms.

**Deploy click** — card scales to 0.98 for 80ms (acknowledge press), then back to 1.0 with spring, accent border traces the perimeter over 880ms (CSS conic-gradient + mask trick), and the card transitions into the dashboard view.

## Microinteraction copy

Every animation has a "tone" instruction for designers/devs to maintain consistency:

- **Hover on a button:** "lean in" — fast, slight, certain. 120ms.
- **Reveal of a section:** "settling into place" — like a book being set down. Ease-out, 380ms, no bounce.
- **Loading a result:** "the system is thinking" — calm steady pulse, never frantic spinning.
- **Successful action:** "yes" — short, single, satisfying. Spring with mild overshoot. 380ms.
- **Error:** "no, try again" — soft horizontal shake, no shouting. 180ms total.
- **Page transition:** "turning the page" — instant exit, gentle entrance. Total 600ms.
- **Live agent activity:** "pulse of life" — endless slow heartbeat at the accent color.

## States & transitions

### Audit run

- **Idle**: card empty, eyebrow says "READY".
- **Connecting** (Trigger: user clicks "Connect Gmail"): terminal log appends, eyebrow → "CONNECTING".
- **Reading** (Trigger: token returned): rows append with shimmer.
- **Complete** (Trigger: Claude returns categorization): blur clears, dollar amount counts up.
- **Error**: red eyebrow, retry button slides in. No shake — errors here are too important to feel cute.

### Agent deployment

- **Listed** (in `/agents`): card visible, "Deploy" button hidden until hover.
- **Hovered**: card lifts, deploy button fades in.
- **Deploying** (Trigger: deploy clicked): card scales 0.98, then border traces with accent.
- **Active** (Trigger: row exists in dashboard): card on dashboard with pulse dot.
- **Working** (Trigger: cron run starts): pulse dot accelerates to 1.4Hz briefly, then back to 0.4Hz.
- **Action ready** (Trigger: draft inserted): toast slides in.

### Form submission (auth, onboarding)

- **Idle** → **Submitting** → **Success/Error**
- Success: route transition with 220ms outgoing fade + 380ms incoming fade.
- Error: shake + inline message, focus returns to first invalid field.

## Implementation Guide

### Global CSS tokens — drop in `globals.css`

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --dur-instant: 120ms;
  --dur-quick: 220ms;
  --dur-base: 380ms;
  --dur-slow: 680ms;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 120ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 120ms !important;
    scroll-behavior: auto !important;
  }
  .reveal, .reveal-2 { transform: none !important; }
}

@keyframes reveal-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

.reveal   { animation: reveal-up var(--dur-slow) var(--ease-out) both; }
.reveal-2 { animation: reveal-up var(--dur-slow) var(--ease-out) 200ms both; }

.pulse-soft {
  animation: pulse-soft var(--dur-pulse, 2400ms) linear infinite;
}
@keyframes pulse-soft {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1.0; }
}

.stagger > * { opacity: 0; animation: reveal-up var(--dur-base) var(--ease-out) both; }
.stagger > *:nth-child(1) { animation-delay: 0ms; }
.stagger > *:nth-child(2) { animation-delay: 70ms; }
.stagger > *:nth-child(3) { animation-delay: 140ms; }
.stagger > *:nth-child(4) { animation-delay: 210ms; }
.stagger > *:nth-child(5) { animation-delay: 280ms; }
.stagger > *:nth-child(6) { animation-delay: 350ms; }
```

### Framer Motion — primitives

```tsx
// src/components/motion.tsx
"use client";
import { motion, useReducedMotion, type Variants } from "framer-motion";

export const ease = [0.16, 1, 0.3, 1] as const;
export const easeIn = [0.7, 0, 0.84, 0] as const;
export const spring = { type: "spring", stiffness: 320, damping: 26, mass: 0.8 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.68, ease } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  // implementation ticks 0 → value via rAF over 1200ms ease-out
  // (full impl in src/components/AnimatedCounter.tsx)
  return <span>{prefix}{value.toLocaleString()}{suffix}</span>;
}
```

### Audit "shimmer" row — Three.js-free, GPU-only CSS

```css
.shimmer {
  position: relative;
  overflow: hidden;
}
.shimmer::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(212, 255, 58, 0.08) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: shimmer-pass 1200ms linear infinite;
  pointer-events: none;
}
@keyframes shimmer-pass {
  to { transform: translateX(100%); }
}
```

### Three.js — background "orb field" (already exists in `src/components/OrbField.tsx`)

```tsx
// principle: 30 low-opacity spheres drifting on z-axis sine curves
// camera locked, no user interaction, GPU-only
// frame budget: < 1.6ms/frame on mid-tier laptop
// pause when document.hidden = true (don't drain battery on backgrounded tabs)
```

Performance gates for OrbField:
- Use `InstancedMesh` (single draw call for all 30 orbs).
- Disable when `prefers-reduced-motion` or viewport < 768px.
- `requestAnimationFrame` with delta-time clamp at 33ms (don't fast-forward after a long stall).
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — never 3x.

## Animation timeline — the audit reveal (the product's signature moment)

```
Frame 0ms:    User clicks "Run audit"
Frame 80ms:   Button confirms (scale 0.98 → 1.0 spring)
Frame 240ms:  Card eyebrow swaps "READY" → "CONNECTING" (220ms crossfade)
Frame 480ms:  Terminal line 1 appended ("> connecting gmail.aidan@... ✓")
Frame 920ms:  Line 2 ("> reading 14d window ........ 487 threads")
Frame 1320ms: Line 3 ("> reading calendar 14d ...... 62 events")
Frame 1840ms: Line 4 ("> categorizing with claude .. ") + spinner appended
Frame 1840–4200ms:  Real Claude call. While streaming, dots cycle "..." every 320ms.
Frame 4200ms: Line 4 completes ("done"). Line 5 appends.
Frame 4500ms: Result card BEGINS reveal — backdrop blur drops, rows shimmer in.
Frame 4500ms: Row 1 enters with shimmer pass (1200ms loop, 1 cycle then ends).
Frame 4640ms: Row 2 enters (stagger +140ms behind row 1).
Frame 4780ms: Row 3 enters.
Frame 4920ms: Row 4 enters.
Frame 5300ms: All rows resolved. Recoverable dollar amount begins ticking.
Frame 5300–6700ms: Counter from $0 → $3,420. Accent color, ease-out.
Frame 6700ms: Counter pulse starts (3 cycles, then settles).
Frame 8800ms: All motion concluded. UI is at rest.
```

Total: ~8.8s for the full reveal. Feels like ~3s subjectively because each beat lands when expected.

## Technical notes

- **Browser support**: Tested on Chrome 120+, Safari 17+, Firefox 121+. `cubic-bezier` and `prefers-reduced-motion` are universal. `backdrop-filter` falls back to `background-color` increase on Firefox <103.
- **Performance**:
  - Animate only `opacity` and `transform`. Never `width`, `height`, `top`, `left`, `margin`, or `padding` for entrance animations (use FLIP if you need layout animation).
  - Pin `will-change: transform, opacity` on actively-animating nodes; remove on animation end.
  - The OrbField scene must stay under 1.6ms/frame at 60fps on mid-tier hardware. Profile with Chrome DevTools rendering panel.
- **Accessibility**:
  - All animations respect `prefers-reduced-motion: reduce` — collapse to 120ms opacity-only.
  - Live-status pulse runs continuously, but it's pure decoration; screen readers don't announce it.
  - Counters announce final value once via `aria-live="polite"`, never the intermediate ticking values.
  - Toasts are `role="status"` (non-interrupting) for routine updates, `role="alert"` for errors.
- **Responsive**:
  - On mobile (< 768px): stagger drops to 50ms, durations drop 20%. Hero translateY drops to 8px (tighter screens, less vertical real estate).
  - The OrbField is hidden on mobile entirely.
  - Touch targets ≥ 44px regardless of motion.

## Handoff notes

- **Don't reach for spring physics by default.** It's reserved for "agent took action" confirmations. Everywhere else, ease-out cubic-bezier is correct.
- **Stagger is structural, not visual.** A staggered row reveal communicates "these items came from the same source." A non-staggered reveal communicates "these are independent." Choose based on data, not vibe.
- **Counters are real data.** Do not animate placeholder values. The number on screen at frame 800ms must be a real intermediate value.
- **Pulse is sacred.** The accent pulse is the product's only repeating animation. Don't add a second pulsing element on the same screen — it dilutes the signal.
- **The OrbField is muted.** It exists at 30% opacity. If you ever find yourself reaching for "more visual interest" by turning it up, the answer is no — the product is editorial, not arcade.
- **Test the audit reveal at 25% playback speed.** If any beat looks wrong slowed down, it's wrong at full speed too — the user is just hiding the flaw with motion blur.

---

This spec is the source of truth. When in doubt, refer back. When implementation deviates, update the spec — never let code and spec drift.

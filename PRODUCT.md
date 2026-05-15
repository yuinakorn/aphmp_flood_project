# PRODUCT.md — FloodWatch

## Register

**product** — A tool that serves a workflow. Design discipline serves the operator, not the brand.

## Users & Purpose

**Primary**: Public-health disaster operators: EOC/ปภ. command staff, district health workers (รพ.สต.), EMS, and อสม. coordinating vulnerable-person care during flood events.

**Operating context**: Desktop monitors in a low-light command center, often at 2am after a heavy-rain advisory. Multiple operators around a shared screen, occasional executives glancing from 2–3m away. Cognitive load is already high before they open the app.

**Job to be done**: At a glance, answer "where is the water now, which vulnerable people are affected, what has the อสม./field team already done, and who should move to which shelter first." Drill-down (rather than scroll-down) into a specific person, visit, help request, shelter, or sub-district. Then dispatch an action — call caregiver, request EMS, assign shelter, mark visited, mark moved.

Secondary: อสม. using a mobile-first field workflow to confirm vulnerable-person status, report community conditions, and submit help requests in low-connectivity areas.

Tertiary: District health workers (รพ.สต.) maintaining the vulnerable-persons registry and shelter readiness on calmer days. Same shell, lighter density, no command-center theming bleeding into form work.

Quaternary, read-only: Public (anonymous) checking whether their tambon is in a confirmed flood polygon — masked data, no individual identification.

## Current Product Focus

The SRS describes a broader flood disaster management system, but the near-term product direction is **health-first**:

1. **Vulnerable-person and patient registry.** Track location, risk level, medical priority, caregiver contact, equipment needs, visit status, and evacuation status.
2. **อสม. field operations.** Let village health volunteers verify records, report conditions, submit help requests, and receive status updates from command/EMS.
3. **Shelter health management.** Track shelter capacity, occupancy, health readiness, and suitability for vulnerable groups such as bedridden patients or people needing electricity/oxygen support.

Flood maps, evacuation points, danger points, and routes remain supporting context. Food logistics, fire incidents, and full rescue dispatch are adjacent workflows, not the first product center of gravity.

## Brand Personality

**Calm-authoritative** (primary) with a **20–30% operations-terminal** undertone.

- Calm-authoritative: composed surface, generous breathing room around critical numbers, single-color emphasis. Not loud. The screen does not panic before the operator does.
- Operations-terminal touch: monospace numerics for coordinates / counts / timestamps, status pills with precise verbs, no decorative iconography. References: Linear status pages, Vercel observability, Datadog dense views — used as flavor, not as the dominant note.

## Anti-references (do not look like these)

1. **Thai government website (กรอบเยอะ, clip-art icons, mixed fonts)**. No boxed-in panels everywhere, no emoji-as-icon, single typeface family for Thai + Latin.
2. **Generic SaaS dashboard (purple gradient + 2×2 stat-card grid)**. No "hero metric" cliché, no card grids of identical tiles, no purple, no gradients on text or surfaces.
3. **Overwhelming crisis UI (full-red flashing alerts)**. Severity is signaled by *position* and *typography weight* first, color second. Color is dosed; red is reserved for "in-flood" risk and never for chrome.
4. **Demo-prototype look (inline styles, emoji icons, ad-hoc spacing)**. Every spacing value comes from one scale, every icon from one library, no font-emoji as visual primitive.

## Strategic Design Principles

1. **One critical answer per screen.** The map page answers "where + who is at risk." The roster/field page answers "who am I responsible for today." The shelter page answers "where can this person safely go." Don't mix.
2. **Status before chrome.** The first thing visible after the masthead is the *current situation* — counts, last SAR pass, areas at risk — not navigation or tooling.
3. **Reveal on demand.** Vulnerable-person identity and evac equipment are masked by default. Identity reveals after sign-in + per-view audit log (PDPA).
4. **Numbers are typography, not boxes.** Stats live on a horizontal status strip with vertical separators. They are not cards. No card grids anywhere.
5. **Action over information.** Every detail view ends in a verb the operator can perform (call caregiver, mark visited, request EMS, assign shelter, mark moved).
6. **Bilingual without bilingual-tax.** Thai is primary; Latin numerals and timestamps coexist without UI duplication. IBM Plex Sans Thai is the single sans family.
7. **Dimmable, not "dark mode."** Theme follows physical scene (low-light command center at night) rather than user-toggle aesthetic. A single calibrated surface, not a theme switcher.

## Accessibility & Inclusion

- WCAG 2.2 AA for contrast on all data display. AAA on the critical "flood / near / safe" risk pills.
- Status is communicated by **icon + label + position**, not color alone (operators include color-vision-deficient staff).
- Reduced-motion respected: map-pan animations and panel slide-overs collapse to opacity-only.
- Keyboard: map should be navigable enough to pan/zoom and open person details without a mouse (escape to close popovers, `/` to focus search).
- Text scales correctly at 125% browser zoom without horizontal scroll in the sidebar.

## Out of scope (for v1)

- No social/sharing features.
- No public registration. Sign-in is provisioned by admin only.
- No general-purpose public call-for-help intake until the อสม./authorized-field workflow is stable.
- No full food/water logistics module; capture shelter needs only where it affects health readiness.
- No full fire/rescue incident command workflow beyond danger points and EMS/rescue handoff needed for vulnerable-person care.
- No theme switcher. Theme is calibrated once.
- No marketing landing page; "/" redirects to /map.

# Ingenio Crew UI System Guide

## Intent & Principles
- Deliver a cohesive Ingenio visual language so new applications feel like part of the same family, even when functionality differs.
- Lead with accessibility: maintain strong contrast, predictable spacing, and clear interactive affordances across light and dark themes.
- Favour reusable utility classes or design tokens rather than bespoke styling so colours, typography, and spacing stay in sync.

## Layout System
### Root Application Frame
- Default view opens in dark mode but must be fully theme-aware; a user-controlled toggle should switch to the light palette without visual regression.
- Pages stretch to full viewport height, using a flexible two-column layout: a persistent navigation rail on the left and a fluid content area on the right.
- Body copy sits on a neutral backdrop (dark navy in dark mode, light grey in light mode) to create separation from cards and widgets.

### Sidebar Navigation
- Persistent vertical navigation with a collapsible width. Expanded state is roughly 256px wide to allow icon + label; collapsed state reduces to icon-only around 64px.
- Background: deep navy gradient in dark mode (`#1C2533` to `#222E40`), crisp white in light mode.
- Border treatment: subtle hairline divider (24% lightness navy in dark theme, cool grey in light theme) to separate the rail from main content.
- Navigation items: outline icons (Lucide-style, 20px size) paired with sentence-case labels. Hover states lighten the background (`rgba(255,255,255,0.08)` dark, `#F3F4F6` light).
- Active state: filled Ingenio Yellow pill (`#DEDC00`) with navy text and bold weight. Sub-navigation lists indent with a fine vertical accent line.
- Mobile behaviour: navigation slides in from the left with a tinted overlay (`rgba(0,0,0,0.5)`), triggered by a floating circular button in brand navy.

### Content Wrapper
- Primary background: desaturated grey (`#111827` dark, `#F9FAFB` light).
- Page padding targets 24px on small screens and scales to 32px on large displays. Use a max content width around 1120–1280px for dashboard-style layouts.
- Page headers: elevated strip with subtle shadow. Light mode uses white with navy text; dark mode uses slate (`#1F2937`) with white text. Include title, short description, and right-aligned action buttons.
- Grid pattern: responsive rows that begin as a single column, breaking to two and three columns at medium (≥768px) and large (≥1024px) widths respectively.

## Theme & Colour Tokens
The system relies on CSS custom properties so colours shift cleanly between light and dark themes.

### Light Theme Palette
| Token | HSL | Hex | Purpose |
| --- | --- | --- | --- |
| `--background` | `0 0% 100%` | `#FFFFFF` | Card backgrounds, popovers, header surfaces. |
| `--foreground` | `212 30% 19%` | `#222E40` | Body text and iconography on light surfaces. |
| `--primary` | `212 30% 19%` | `#222E40` | Navigation highlights, key headings, icon tinting. |
| `--secondary` | `287 38% 41%` | `#824192` | Secondary actions, avatar fills, contextual accents. |
| `--accent` | `59 100% 44%` | `#DEDC00` | Primary call-to-action backgrounds, active navigation items, monetary amounts. |
| `--highlight` | `39 97% 50%` | `#F8AB08` | Success highlights, badge callouts, celebratory moments. |
| `--muted` | `210 40% 96%` | `#F1F5F9` | Section dividers, card backgrounds when nesting content. |
| `--border` / `--input` | `214 32% 91%` | `#E2E8F0` | Card outlines, form field borders. |
| `--ring` | `59 100% 44%` | `#DEDC00` | Focus states around buttons/inputs. |
| `--destructive` | `0 84% 60%` | `#EF4444` | Destructive buttons and validation errors. |

### Dark Theme Palette
| Token | HSL | Hex | Purpose |
| --- | --- | --- | --- |
| `--background` | `212 30% 12%` | `#141C29` | Global background behind content. |
| `--foreground` | `0 0% 100%` | `#FFFFFF` | Primary text on dark surfaces. |
| `--card` | `212 30% 16%` | `#1C2533` | Cards, modals, floating panels. |
| `--primary` | `212 40% 30%` | `#1F2E46` | Elevated navigation highlights, header bars. |
| `--secondary` | `287 45% 52%` | `#9C4BB3` | Secondary call-to-actions with improved contrast. |
| `--accent` | `59 100% 44%` | `#DEDC00` | Primary buttons remain bright to stand out against navy. |
| `--highlight` | `39 97% 58%` | `#FFB224` | Warm celebratory accents in dashboards. |
| `--muted` | `212 20% 20%` | `#1E2633` | List separators, input backgrounds. |
| `--border` / `--input` | `212 20% 24%` | `#242F3F` | Card borders, input outlines. |
| `--ring` | `59 100% 44%` | `#DEDC00` | Focus state; stays consistent across themes for recognition. |
| `--destructive` | `0 72% 55%` | `#F87171` | Error emphasis with increased brightness for dark backgrounds. |

### Theme Behaviour
- **Default**: dark theme for daily use in low-light environments; ensure no element relies on light theme only.
- **Toggle**: theme switch should be instantly responsive with zero layout shift; rely on CSS variables for colour changes.
- **Contrast**: maintain at least WCAG AA; accent yellow on dark backgrounds may need navy text for legibility.
- **Elevation**: shadows are subtle in light theme; in dark theme, use lighter borders (`rgba(255,255,255,0.04)`) instead of heavy shadows to convey depth.

## Typography
- **Primary Typeface**: Manrope for headings and UI chrome. Use weight 600 for section titles and 700 for page titles.
- **Body Typeface**: Lato for long-form text and supporting copy, weight 400 for paragraphs, 700 for emphasis.
- **Scale**: Page titles 32px, section headers 20–24px, body copy 14–16px, captions 12px. Keep line heights generous (1.4–1.6) for readability.
- **Microcopy**: Status pills and overlines use uppercase lettering with letter-spacing around 0.08em.

## Core Components & Interaction Patterns
### Navigation Rail
- Icons and labels align on an 8px grid. Expand/collapse controlled by a toggle button near the rail header.
- Admin-only sections display lock or shield iconography; differentiate using lighter text to indicate secondary priority.
- Sub-navigation items appear within indented groups with a thin accent border to the left.

### Page Headers
- Layout: title/subtitle stack on the left, action buttons on the right. Buttons remain vertically centred.
- Buttons: primary action in Ingenio Yellow with navy text; secondary action with subtle outline (transparent background, thin border, slight shadow on hover).
- Sign-out or tertiary links appear as muted text buttons with hover underline or tint.

### Insight Cards & Metrics
- Cards are rounded (8px radius) with a left-hand colour bar 6px wide. Choose accent colour based on metric type: purple for allowances, yellow for wallet values, orange for engagement counts, navy for general info.
- Metrics appear in large numerals (28–32px) with currency symbols or units in smaller size aligned baseline.
- Cards can be interactive; hover states increase elevation and lighten border to indicate clickability.

### Activity Feed
- Feed items use vertical accent colours to signal category: yellow for peer recognition, green for CSAT activity.
- Include emoji (trophy, smiley faces) next to category labels to give quick visual read.
- Each item features: title line with bold participant names, optional italicised quote, metadata row with timestamp and value. Maintain consistent spacing between items using 16px gaps.

### Filters & Segmented Controls
- Filter buttons are pill-shaped with 24px horizontal padding and 32px min height.
- Active filter uses filled background (navy/yellow/purple depending on context) with bold text. Inactive state is neutral with light border and subtle hover fill.

### Forms & Inputs
- Input fields have 12px vertical padding, 14px text, and 4px corner radius.
- Labels sit above inputs, spaced by 4px, using medium-weight typography.
- Helper text is muted grey in light mode and slate in dark mode; error text switches to the destructive red.
- Buttons below forms align to the right, with primary action in yellow and secondary actions styled as outline.

### Buttons
- **Primary**: Ingenio Yellow background, navy text, medium weight. Hover slightly darkens yellow; focus ring uses accent yellow outline.
- **Secondary**: Transparent background with navy text in light mode, flipped to white text on muted navy background in dark mode.
- **Destructive**: Solid red background with white text, consistent across themes.
- Disabled state uses 60% opacity and removes hover/active shadows.

### Modals & Overlays
- Overlay tint uses semi-transparent black. Ensure underlying content remains visible but subdued.
- Modal container width up to 640px with 24px corner rounding. Provide 24px internal padding and a 16px gap between header, body, and footer.
- Modal header contains title and icon-only close button; button uses subtle hover tint rather than colour change.

### Identity Treatment
- Default avatar: circular, 32px diameter, Ingenio Purple background with white initials set in Manrope bold.
- Avatar presence in cards/app header indicates signed-in user role; include small role label in muted text directly beneath.

## Iconography & Illustration
- Use thin-stroke outline icons (Lucide or equivalent) at 1.5–2px stroke. Primary nav icons at 20px, submenu icons at 16px.
- Maintain consistent icon alignment within a 24px square when paired with text to prevent wobbling.
- Emoji enhance storytelling in feeds; stick to a curated set (trophy, sparkles, smile faces) to avoid clutter.

## Spacing, Elevation & Density
- Grid spacing follows a 4px base: margins/padding typically 16px or 24px. Avoid odd values unless aligning to pixel grid for icons.
- Vertical rhythm inside cards: 12px between body rows, 20px between card header and content.
- Shadows: light theme uses soft drop shadow (`0 10px 25px rgba(15,23,42,0.05)`); dark theme relies on lighter borders plus a faint highlight to simulate depth.
- When stacking cards, ensure 24px gap to maintain airiness; inside dense tables, column padding can reduce to 12px to improve data density.

## Motion & Feedback
- Expand/collapse animations for accordions or navigation groups run over 200ms with ease-out curve; height transitions from 0 to content height.
- Buttons transition colour and shadow over 150–200ms; avoid major positional shifts to keep experience calm.
- Loading states favour skeleton lines or text placeholders. Global operations trigger toast notifications with brand accents (yellow for success, red for errors).
- For modal opening/closing, fade and scale from 96% to 100% for a smooth entrance.

## Implementation Checklist
- Start every screen with the dark palette enabled; verify all text and interactive elements meet contrast before testing light mode.
- Reuse the navigation rail, header layout, and stat card patterns to ensure visual continuity across teams and products.
- Apply the colour tokens listed above rather than ad-hoc values; this makes theme switching seamless.
- Confirm responsive behaviour at small (≤640px), medium (≥768px), and large (≥1024px) breakpoints—the UI should gracefully collapse sidebar, stack cards, and keep content legible.
- When building new components, match typography scale, spacing increments, and icon sizing outlined in this guide so the experience feels immediately familiar.

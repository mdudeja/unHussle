# AGENTS.md

## Project Details

- This is a bun project. Use bun commands instead of npm or yarn. For example, use `bun install` instead of `npm install` or `yarn install`.
- More details about the project can be found in the [README.md](README.md) file.

## Coding Methodology

### Simplicity & Pragmatism

- DRY, KISS, YAGNI, SOLID.
- Between two working solutions, take the simpler, more readable one.
- Prefer the proven, standard solution for the stack over a custom one.
- Never write code for hypothetical future requirements.
- Prefer deleting code over adding abstractions.
- When in doubt, find what’s over-engineered and remove it.
- No new dependencies without strong justification.

### Organisation

- Files stay small, focused, single-responsibility.
- Reusable logic lives in hooks, lib, or helpers.
- UI components stay purely presentational.
- Avoid prop drilling; use composition.
- Semantic HTML elements (`main`, `nav`, `section`, `ul`) over generic `div`s.

### Reliability

- Handle loading and error states explicitly in every async operation.
- Errors are visible and actionable, never silent. No empty catch blocks.
- Fail loudly; no silent fallbacks that hide a failure.
- Validate inputs; assume nothing about data shape or timing.
- Validate on the server even when the client already does.
- Guard against race conditions and stale data.
- No side effects during render. No stored derived state or unnecessary `useEffect`.

### Maintenance & Consistency

- Meaningful names. One name per concept, one unit per measure.
- One order per list: the same in UI, code, and docs.
- No magic numbers or strings; name them once as constants.
- File and folder names in kebab-case.
- Remove unused code the moment you find it.
- Refactor only when it improves readability or maintainability.
- Alias imports (`@/`) everywhere; no relative `./` or `../`.
- Never use non-keyboard characters, except those already used across UI and markdown.

### Comments & Docs

- Write self-explanatory code. Comments only where genuinely necessary.
- Never restate what the code already says.
- Break a long comment across lines rather than one long trailing line.
- Compress relentlessly: minimal, no redundancy, readable by a junior.
- If one line explains it, don’t write three.
- Copy across UI and markdown must be consistent, grammatical, and typo-free.

## Design Methodology

### Principles

- Clarity and predictability matter more than visual appeal or delight.
- Minimal, modern, serious, and consistent across all interactions.
- Optimise for first-time and low-literacy users; assume no prior training.
- Responsive across all common device sizes.
- Reuse existing layouts and components before adding new ones.
- Keep UI text short and plain; cut any sentence that adds nothing.

### Visual System

- Fixed system for spacing, typography, colour, and layout.
- Prefer ShadCN components over hand-rolled ones.
- Keep `components/ui` as installed: never edit or prune it; customise at the usage.
- Colour communicates state, never decoration (success, warning, error, disabled).
- No animation beyond essential micro-feedback: button press, loading spinner.
- Generous whitespace; no visual clutter.

### Tailwind CSS

- Stick to the default scale; no arbitrary values without reason.
- Fewest classes that do the job; remove any that have no effect.
- Utilities stay in markup; never extract them into custom CSS classes.
- All tokens live in `@theme` in `src/styles/App.css`; never hardcoded in markup.
- Semantic token names (`bg-destructive`), not raw palette (`bg-red-500`).
- Mobile-first responsive prefixes; never desktop-first overrides.
- Use `gap` between siblings; avoid margin-chaining.
- Conditional classes via `cn()`; never string concatenation.
- Radius is `0` by design; never add `rounded-*` classes to override it.
- Fonts via the `font-sans` token; never raw `font-family` in markup.

### Feedback

- Every action must produce immediate, visible feedback.
- Errors must be inline, specific, and suggest resolution.
- Loading states must be explicit; never leave users guessing.
- Empty states must explain what’s missing and how to proceed.

### Forms

- Forms must be short, forgiving, and explicit about requirements.
- Labels must always be visible; never rely solely on placeholders.
- Validate inline on blur; summarise errors on submit.
- Use appropriate input types (date pickers, dropdowns) to reduce errors.

### Tables

- Sortable and searchable by default; actions column non-sortable.
- Internally scrollable, not the whole page.
- Paginate large datasets; never render unbounded lists.
- Clear headers, with numbers and text both left-aligned.

### Actions

- UI must never expose actions the user cannot perform.
- Destructive actions must require explicit confirmation.
- Primary actions must be visually distinct; limit one per context.
- Disabled states must explain why the action is unavailable.

### Files

- Uploads must show progress, success, and failure states.
- Display file name, size, and type after selection.
- Provide clear options to retry or remove failed uploads.

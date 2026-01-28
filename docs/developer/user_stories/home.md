# Home View - User Stories

## Overview
The home view is the default landing page when users open unHussle. It focuses on radical simplicity: show the next task and provide a frictionless way to capture new thoughts.

## Core User Stories

### US-H1: View Next Task Card
**As a** user opening the app  
**I want to** immediately see my next task in a single, prominent card  
**So that** I know exactly what to focus on without mental overhead

**Acceptance Criteria:**
- [ ] A single card is displayed prominently on the home view
- [ ] The card shows the next task title
- [ ] The card shows task context (project/area if assigned)
- [ ] If no tasks exist, show a calm empty state with gentle guidance
- [ ] The card is visually distinct and draws focus naturally
- [ ] Task information is readable and well-formatted

**Notes:**
- "Next task" determined by priority/due date logic in TasksService
- Empty state should not feel like failure - encourage starting fresh

---

### US-H2: Quick Brain Dump Input
**As a** user with a new thought or task idea  
**I want to** quickly capture it without leaving the home view  
**So that** I can get it out of my head and return to what I was doing

**Acceptance Criteria:**
- [ ] A minimal input field is always visible on the home view
- [ ] Input accepts text entry immediately without extra clicks
- [ ] Pressing Enter/Return saves the item to the inbox
- [ ] After saving, the input clears and is ready for the next item
- [ ] Visual feedback confirms the item was captured
- [ ] No complex forms or required fields - just capture the thought
- [ ] Typing '#' suggests tags, projects, areas. Add a new one if it doesn't exist.
- [ ] Typing '~' allows setting task flags quickly (is_fun, is_chore, is_quick).
- [ ] Two buttons for high and low priority tasks (e.g., "!" and "–"). Default is medium priority.
- [ ] Typing '@@' opens a way to set a due date/time quickly, and checks for conflicts with existing timed tasks.

**Notes:**
- Items go to an "inbox" or "brain dump" collection for later processing
- Consider placeholder text like "What's on your mind?" or "Capture a thought..."
- Keep styling minimal - maybe just a subtle border or underline

---

### US-H3: Start Task from Home
**As a** user ready to work  
**I want to** start the next task directly from the home card  
**So that** I can begin working with one click

**Acceptance Criteria:**
- [ ] The next task card has a clear "Start" or similar action button
- [ ] Clicking starts the task timer
- [ ] Visual feedback shows the task is now active/running
- [ ] Timer display becomes visible after starting
- [ ] No navigation required - stays on home view while working

**Notes:**
- This connects to the time tracking system
- Consider showing elapsed time on the card once started

---

### US-H4: Clean, Distraction-Free Layout
**As a** user seeking focus  
**I want to** see only essential information when I open the app  
**So that** I feel calm and can concentrate on what matters

**Acceptance Criteria:**
- [ ] Home view contains only two primary elements: task card + brain dump input
- [ ] Generous whitespace between elements
- [ ] No navigation clutter or sidebar visible by default
- [ ] Minimal color use - rely on the calm color palette
- [ ] Typography is clear and comfortable to read
- [ ] No animations or auto-refreshing content that demands attention

**Notes:**
- Navigation can be hidden/minimized - accessible via menu icon if needed
- Goal is to feel like opening a peaceful notebook, not a busy dashboard

---

## Future Considerations (Not in MVP)

- Quick access to mark task as complete from home card
- Show task description/notes on the card (toggleable?)
- Keyboard shortcuts for brain dump input (e.g., Cmd/Ctrl+K)
- Multiple brain dump items visible in a queue
- Gentle encouragement messages in empty states
- Time-of-day appropriate greetings ("Good morning," etc.)

---

## Design Principles for Home View

1. **Radical Simplicity**: If it's not essential to the next action, it doesn't belong here
2. **Zero Decisions**: User should know exactly what to do without thinking
3. **Frictionless Capture**: Never lose a thought because the tool got in the way
4. **Calm Aesthetics**: Visual design should reduce anxiety, not create it
5. **Respectful of Attention**: No notifications, badges, or urgency cues on home

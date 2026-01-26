# User Stories: Task Management

## 1. View Tasks

**As a** User
**I want to** see a list of my saved tasks
**So that** I can know what I need to work on.

### Acceptance Criteria

- [ ] When the application loads, it fetches the list of tasks from the backend.
- [ ] Tasks are displayed in a clean list format.
- [ ] Each task shows its `title` and current `status`.
- [ ] If the list is empty, a helpful "empty state" message is shown.
- [ ] Implementation uses the `GET /tasks` API endpoint.

## 2. Add Task

**As a** User
**I want to** quickly add a new task
**So that** I can capture an idea or to-do before I forget it.

### Acceptance Criteria

- [ ] There is a prominent "Add Task" button or input field.
- [ ] Entering a `title` and submitting creates a new task.
- [ ] The new task immediately appears in the task list without a full page reload (optimistic UI or re-fetch).
- [ ] Defaults are applied for `status` ("planned") and `priority` ("medium").
- [ ] Implementation uses the `POST /tasks` API endpoint.

## 3. Remove Task

**As a** User
**I want to** remove a task
**So that** I can declutter my list from items I implemented or no longer need.

### Acceptance Criteria

- [ ] Each task has a "Delete" or "Remove" option (e.g., icon or right-click context menu).
- [ ] Clicking remove prompts for confirmation (optional, but good UX) or deletes immediately.
- [ ] The task is removed from the visible list.
- [ ] Implementation uses the `DELETE /tasks/:id` API endpoint.

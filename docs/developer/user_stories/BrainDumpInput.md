# Brain Dump Input Box - User Stories

## Overview
The Brain Dump Input Box is a feature designed to help users quickly jot down their thoughts, ideas, and tasks without worrying about organization or formatting. This tool is particularly useful for brainstorming sessions, capturing fleeting ideas, and decluttering the mind.

## Features
- Quick text entry
- Ability to add tags, projects, goals or areas. All start with '#'
- A searchable dropdown appears as user types after '#', showing existing tags, projects, goals or areas to select from.
- If no existing tag, project, goal or area matches, user can create a new one by completing the text after '#'.
- Default assumption is that input is a task.
- Can add a resource too. Any link - web or file - becomes a resource automatically. Ability to select files from system, which then become a file link.
- Can expand to a larger text area for more extensive notes. Generates a markdown file when expanded. Markdown has a format that includes a header with date/time, and any tags, projects, goals or areas. A Notes section for notes and an Action Items section for tasks. Tasks get extracted to be added to the tasks system. A link to the markdown file is added to the resources system.
- Simple keyboard shortcuts for quick actions (e.g., Ctrl+Enter to save, Esc to cancel).
- Auto-save functionality to prevent data loss.
- Tasks created from the Brain Dump Input Box are automatically categorized under a "Brain Dump" area for easy tracking if the user did not specify a project, area, goal or tag.
- Tasks can be optionally marked with - 
    - High or Low Priority (default is Medium)
    - is_fun, is_chore or is_quick flags
    - estimated time to complete
- Tasks can also indicate a due date by way of specific keywords like "today", "tomorrow", "this week", or specific dates in DD/MM/YYYY format, or natural language like "next Friday", "end of the month", "4th January" etc.

## User Stories
- [ ] As a user, I want to quickly jot down my thoughts and ideas without worrying about formatting, so I can capture them before I forget.
- [ ] As a user, I want to add tags, projects, goals, or areas to my entries, so I can categorize and organize my thoughts later.
- [ ] As a user, I want a searchable dropdown to help me find existing tags, projects, goals, or areas as I type, so I can maintain consistency in my categorization.
- [ ] As a user, I want to create new tags, projects, goals, or areas if none match my input, so I can customize my organization system.
- [ ] As a user, I want the input box to automatically recognize links as resources, so I can easily save relevant web pages or files.
- [ ] As a user, I want the option to expand the input box into a larger text area, so I can write more detailed notes when needed.
- [ ] As a user, I want the system to generate a markdown file for my expanded notes, so I can have a structured format for future reference.
- [ ] As a user, I want tasks created from my brain dump to be automatically categorized under a "Brain Dump" area if I don't specify one, so I can easily track them later.
- [ ] As a user, I want a quick and painless way to set priority levels and flags for my tasks.
- [ ] As a user, I want to indicate due dates for my tasks using natural language or specific date formats.
- [ ] As a user, I want simple keyboard shortcuts for saving and canceling my entries, so I can work efficiently.
- [ ] As a user, I want auto-save functionality to prevent data loss, so I can feel secure while using the Brain Dump Input Box.
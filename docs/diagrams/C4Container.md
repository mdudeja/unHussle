## Architecture Overview
unHussle uses a sophisticated sidecar architecture where:

- A Tauri desktop shell wraps a React frontend
- The Tauri app spawns a local Elysia API server as a child process
- All data is stored in a local SQLite database
- Completely offline-capable - no external dependencies

## C4 Container Diagram

```mermaid
C4Container
title Container Diagram for unHussle - Local-First Desktop Productivity App

Person(user, "End User", "Individual managing personal tasks, projects, goals, and time tracking")

System_Boundary(unhussle, "unHussle Desktop Application") {
    Container(tauri_shell, "Tauri Desktop Shell", "Rust", "Native OS wrapper, manages window lifecycle, spawns and controls database server sidecar process")
    
    Container(react_frontend, "React Frontend Application", "React 19, TypeScript, Zustand, Vite", "Provides task management UI with areas, projects, goals, time tracking. Runs on localhost:1420")
    
    Container(api_server, "Database API Server (Sidecar)", "Elysia, Bun Runtime", "REST API with CRUD endpoints for all entities. Auto-generated Swagger docs. Runs on localhost:3456 as spawned child process")
    
    ContainerDb(sqlite_db, "SQLite Database", "SQLite 3, Drizzle ORM", "Local file storage for tasks, projects, areas, goals, resources, tags, URLs, time entries with relational schema")
    
    ContainerDb(localstorage, "Browser LocalStorage", "Web Storage API", "Persists active time tracking sessions across app restarts")
    
    Container(migrations, "Drizzle Migrations", "SQL Scripts", "Bundled database schema migrations applied on startup")
}

Rel(user, react_frontend, "Uses desktop app for task and time management", "UI Interactions")
Rel(react_frontend, tauri_shell, "Embedded in", "Tauri WebView")

Rel(react_frontend, api_server, "Makes REST API calls", "HTTP/JSON (localhost:3456)")
Rel(react_frontend, localstorage, "Persists active time tracking", "Web Storage API")

Rel(tauri_shell, api_server, "Spawns and manages lifecycle", "Sidecar Process + ENV vars")

Rel(api_server, sqlite_db, "Reads/writes entity data", "Drizzle ORM / SQL")
Rel(api_server, migrations, "Applies on startup", "File System")

Rel(tauri_shell, sqlite_db, "Configures path", "AppData directory")
Rel(tauri_shell, migrations, "Bundles as resources", "App Resources")

UpdateRelStyle(user, react_frontend, $offsetY="-50")
UpdateRelStyle(react_frontend, api_server, $offsetY="-30")
UpdateRelStyle(tauri_shell, api_server, $offsetY="20")
UpdateRelStyle(api_server, sqlite_db, $offsetY="-40")

UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

## Key Architectural Insights
1. Sidecar Architecture Pattern
- The Tauri shell spawns the db-server binary as a child process on app startup
- Database path and migrations directory passed via environment variables
- Graceful shutdown with SIGTERM when app closes
- Stdout/stderr captured for logging
2. Local-First Design
- No external APIs or cloud services - completely offline
- SQLite database stored in OS-specific app data directory
- All business logic runs locally on user's machine
- Data never leaves the device
3. Communication Flow
```pre
User → React UI → Zustand Store → Entity Service → 
HTTP REST (localhost:3456) → Elysia API → 
Drizzle ORM → SQLite Database
```
4. Technology Stack
- Frontend: React 19, TypeScript, Zustand (state), Vite (build)
- Backend: Elysia (REST API), Bun (runtime), TypeBox (validation)
- Database: SQLite 3, Drizzle ORM, prepared statements
- Desktop: Tauri 2.0 (Rust), native OS integration
- API Design: Generic route generator with consistent CRUD patterns
5. Data Model
- Entities: Tasks, Resources
- Collections: Areas, Goals, Projects (organizational containers)
- Supporters: Tags, URLs, Time Entries (metadata/attachments)
- Relationships: Many-to-many via junction tables
6. Special Features
- Time Tracking: Client-side service using localStorage for persistence
- Health Monitoring: Frontend polls /health endpoint to verify DB connectivity
- Auto-generated API Docs: Swagger UI at localhost:3456/api
- gzip Compression: All API responses compressed
- Database Seeding: Sample data populated on first run

## Container Breakdown

| Container | Technology | Port | Purpose |
|-----------|------------|------|---------|
| Tauri Desktop Shell | Rust | N/A | OS wrapper, sidecar lifecycle management |
| React Frontend | React 19 + TypeScript | 1420 | User interface and client-side logic |
| Database API Server | Elysia + Bun | 3456 | REST API with CRUD endpoints |
| SQLite Database | SQLite 3 + Drizzle | N/A | Local data persistence |
| LocalStorage | Browser API | N/A | Active time tracking sessions |
| Drizzle Migrations | SQL Scripts | N/A | Schema versioning |

This architecture represents a modern local-first desktop application that prioritizes user privacy, offline capability, and data ownership while maintaining the polish and features of cloud-based productivity tools.

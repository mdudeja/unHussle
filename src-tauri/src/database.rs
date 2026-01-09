use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    let migration_v1 = Migration {
        version: 1,
        description: "create_initial_schema",
        kind: MigrationKind::Up,
        sql: "
            -- Tags
            CREATE TABLE tags (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                color TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- Urls
            CREATE TABLE entity_urls (
                id TEXT PRIMARY KEY,
                title TEXT,
                url TEXT NOT NULL,
                protocol TEXT,
                domain TEXT,
                path TEXT,
                query TEXT,
                fragment TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- Areas
            CREATE TABLE areas (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                description TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- Goals
            CREATE TABLE goals (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                description TEXT,
                target_date INTEGER,
                progress INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- Projects
            CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                description TEXT,
                area_id TEXT,
                goal_id TEXT,
                status TEXT CHECK(status IN ('active', 'completed', 'archived', 'on_hold')) NOT NULL DEFAULT 'active',
                deadline INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
                FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
            );

            -- Tasks
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT CHECK(status IN ('todo', 'in_progress', 'completed', 'skipped', 'migrated')) NOT NULL DEFAULT 'todo',
                priority TEXT CHECK(priority IN ('low', 'medium', 'high')) NOT NULL DEFAULT 'medium',
                
                project_id TEXT,
                area_id TEXT,
                goal_id TEXT,
                
                estimated_duration INTEGER,
                time_spent INTEGER DEFAULT 0,
                due_date INTEGER,
                
                is_recurring BOOLEAN DEFAULT 0,
                recurring_rule TEXT,
                is_fun BOOLEAN DEFAULT 0,
                is_chore BOOLEAN DEFAULT 0,
                
                stack_order INTEGER DEFAULT 0,
                scheduled_for INTEGER,
                
                created_at INTEGER NOT NULL,
                completed_at INTEGER,
                updated_at INTEGER NOT NULL,
                
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
                FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
            );

            -- Time Entries
            CREATE TABLE time_entries (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration INTEGER DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            -- Resources
            CREATE TABLE resources (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                project_id TEXT,
                area_id TEXT,
                goal_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
                FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
            );

            -- Entity Tags Junction
            CREATE TABLE junction_tags (
                entity_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (entity_id, tag_id),
                FOREIGN KEY (entity_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (entity_id) REFERENCES resources(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            -- Entity Urls Junction
            CREATE TABLE junction_urls (
                entity_id TEXT NOT NULL,
                entity_url_id TEXT NOT NULL,
                PRIMARY KEY (entity_id, entity_url_id),
                FOREIGN KEY (entity_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (entity_id) REFERENCES resources(id) ON DELETE CASCADE,
                FOREIGN KEY (entity_url_id) REFERENCES entity_urls(id) ON DELETE CASCADE
            );
        ",
    };

    vec![migration_v1]
}

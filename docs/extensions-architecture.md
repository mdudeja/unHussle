# Extensions: architecture

For maintainers. The authoring guide is [extensions.md](extensions.md), and
the concepts are in [mental-models.md](mental-models.md#extensions).

Extensions are trusted, in-process code. The host gives each one a scoped
API, records everything it registers, and undoes it all on disposal.
Compilation and execution belong to the composition registry
([command-composition.md](command-composition.md)). The host never runs
plans itself.

## Module map

| Module                                           | Responsibility                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `common/extensions/sdk.ts`                       | Public types shared by both sides: context, actions, services, atomic domain  |
| `common/extensions/manifest.ts`                  | `extension.json` schema, ID rule, listing schemas, shared-module contract     |
| `common/extensions/host.ts`                      | Scopes, ID checks, guarded services, action spans, logging, ordered disposal  |
| `src-db-server/extensions/application.ts`        | Backend host adapter; adds `api.atomic` on the kernel's atomic boundary       |
| `src-db-server/extensions/queries.ts`            | Backend `services.queries` over repositories and read models                  |
| `src-db-server/extensions/settings.ts`           | `app_settings` read/update helpers; per-extension settings                    |
| `src-db-server/extensions/bundle.ts`             | `Bun.build` of an entry with shared modules mapped to a global                |
| `src-db-server/extensions/manager.ts`            | Discovery, enabled state, backend activation, cached frontend bundles         |
| `src-db-server/routes/extensions.ts`             | HTTP: list, rescan, enable, change folder, frontend bundle                    |
| `src-db-server/extensions/sdk.ts`                | `unhussle/backend` (types only)                                               |
| `src/extensions/application.ts`                  | Frontend host adapter; menus/views store and local-storage settings           |
| `src/extensions/queries.ts`                      | Frontend `services.queries` through the query coordinator                     |
| `src/extensions/loader.ts`                       | Sets the shared-module global; imports and registers enabled frontend entries |
| `src/extensions/hooks.ts`                        | Installed list query, activation effect, load errors                          |
| `src/extensions/sdk.ts`                          | `unhussle/frontend`: types and read-only query hooks                          |
| `src/components/app/ExtensionContributions.tsx`  | Sidebar menus and the `/extensions/:id` view page                             |
| `src/components/app/ExtensionSettings.tsx`       | Preferences card: folder, rescan, on/off with confirmation                    |
| `src-db-server/bootstrap.ts`, `src/bootstrap.ts` | Composition roots; executors never import the host                            |

`unhussle/*` resolve through `tsconfig.json` `paths` inside the repo, so the
samples import exactly as external extensions do.

## Persistence

Persistence lives in `app_settings.settings` (JSON, so no migration):

| Key                 | Meaning                           |
| ------------------- | --------------------------------- |
| `extensionsDir`     | Folder chosen by the user         |
| `enabledExtensions` | IDs the user turned on            |
| `extensions[id]`    | That extension's backend settings |

The folder is resolved as `extensionsDir`, then `EXTENSIONS_DIR`, then
`extensions`. A newly discovered extension is off.

## Flows

**Server start**

1. `server.ts` calls `extensionManager.rescan()`.
2. The manager reads settings, then scans the folder in alphabetical order.
   Each subfolder becomes one `InstalledExtension`: valid, or `invalid` with
   a reason. A duplicate ID marks the later folder invalid.
3. For each enabled entry, the manager bundles its `backend`, writes the
   bundle to a temp file, imports it, deletes the file, and calls
   `host.register(id, default)`. A throw sets `failed` with the message and
   never stops the server.

**Turning an extension on or off** (`PUT /extensions/:id/enabled`)

1. The manager saves `enabledExtensions`, then activates or disposes the
   backend entry, and returns the new list.
2. The settings card invalidates the `extensions` query.
3. `useExtensionActivation` (mounted in `App`) passes the list to
   `extensionLoader.sync`.

**Frontend loading**

1. `sync` computes the wanted IDs: enabled, `active`, and with a `frontend`
   entry. It unloads the others and imports the missing ones from
   `GET /extensions/:id/frontend.js?t=<now>`.
2. The server bundles the entry on first request and caches it until that
   extension is disposed.
3. Failures are kept per ID and shown in the settings card.
4. `reset()` (used on rescan and folder changes) unloads everything and
   makes in-flight imports stale, so old code is never registered.

ES modules cannot be unloaded. Disposal removes registrations, and a
reload imports a new module URL.

## Shared modules

`sharedModules` in `common/extensions/manifest.ts` lists the imports an
extension gets from the host. The bundler plugin turns each one into
`module.exports = globalThis.__unhussle[name]`. The bundler's CommonJS
interop then makes named imports work. The frontend fills the global in
`loader.ts`, and the backend fills it in `bundle.ts`.

Bundles force production JSX (`react/jsx-runtime`), whatever `NODE_ENV` is.

Consequences:

- Extensions use the app's React and TypeBox instances. Upgrading either one
  is a change to the extension contract, so check the samples still load.
- Adding a shared module means adding it to `sharedModules` and to both
  globals in the same change.
- `Bun.build` and `import()` of an on-disk file both work inside the
  `--compile`d sidecar.

## Invariants the host enforces

| Invariant                                                                | Where                        | Tested in                                           |
| ------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------- |
| Extension IDs follow the manifest rule; reserved IDs are refused         | `assertExtensionId`          | `src/__tests__/extensions.test.ts`                  |
| Registration IDs start with `<id>.`                                      | `scope.assertId`             | `src/__tests__/extensions.test.ts`                  |
| Extension commands call only extension-registered actions                | `registrations.command`      | `src-db-server/__tests__/extensions.test.ts`        |
| Workflow steps are commands, not actions or workflows                    | `workflows.register`         | `src/__tests__/extensions.test.ts`                  |
| Disposal undoes in reverse order and continues past a failing cleanup    | `dispose` in `host.register` | `src/__tests__/extensions.test.ts`                  |
| Failed activation undoes partial work and frees the ID                   | `host.register`              | `src/__tests__/extensions.test.ts`                  |
| Removing a provider revokes dependent plans; stale disposers are inert   | `register` tokens            | both `extensions.test.ts` files                     |
| Disposed scopes reject every call                                        | `scope.check`                | both `extensions.test.ts` files                     |
| Atomic plans roll back on throw, promise or bad output; `domain` expires | `domainBoundary.ts`          | `src-db-server/__tests__/extensions.test.ts`        |
| Frontend query results are detached copies                               | `detach` option              | `src/__tests__/extensions.test.ts`                  |
| Discovery, persistence, failure status, bundle contract                  | `manager.ts`                 | `src-db-server/__tests__/extension-manager.test.ts` |
| The loader syncs to the list and ignores stale imports                   | `loader.ts`                  | `src/__tests__/extensions.test.ts`                  |

## Adding a capability to the SDK

1. Add the type to `ExtensionContext` (both sides) or to a side's
   contributions type (`AtomicContributions`, `FrontendContributions`).
2. Implement it in `host.ts`, or in the side's `extra`. Every entry point
   calls `scope.check()`. Anything that must be undone goes through
   `scope.own`. Registry entries go through `registrations`.
3. If it reads app data, add it to `DomainQueries`. Implement it in both
   `queries.ts` files. The host guards it, and detaches it on the
   frontend.
4. Add a test for disposal and for use after disposal, and document it in
   the reference tables in [extensions.md](extensions.md).

## Deliberately not included

The following are deliberately not included:

- a sandbox or permissions
- a marketplace or installer
- file watching (users rescan instead)
- in-place replacement of a registration
- SDK version negotiation

Bundling strips types without checking them. Authors who want type checking
need the repo's SDK types (`src-db-server/extensions/sdk.ts`,
`src/extensions/sdk.ts`) in their editor setup.

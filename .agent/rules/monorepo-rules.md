---
trigger: always_on
---

# Monorepo & pnpm Rules

- **Package Manager**: Always use `pnpm`. Never use `npm` or `yarn`.
- **Workspace Structure**: 
    - `apps/client`: Frontend React application.
    - `apps/server`: Backend Express application.
    - `packages/shared`: Shared types, schemas, and validators.
- **Running Commands**: Prefer running commands from the root using `pnpm --filter`.
- **Dependency Management**: Add shared package dependencies using `workspace:*`.
- **Docker Build Context**: Always use the monorepo root as the Docker build context to allow access to the shared package.
- **Docker Build Command**: Use `pnpm deploy` in multi-stage builds to create pruned, isolated production images.
- **pnpm and Node**: As you know we use pnpm, and we use node, if you have problems running any of these commands, you can first run `PATH="/usr/local/bin:$PATH"` and then retry
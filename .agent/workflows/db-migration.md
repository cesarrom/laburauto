---
description: Perform a database migration in the monorepo
---

# Database Migration Workflow

This workflow describes how to update the database schema and propagate changes to the frontend and backend.

1.  **Update the Shared Schema**:
    Modify the table definitions in `packages/shared/src/schema.ts`.

2.  **Update Shared Types and Validators**:
    - Update `packages/shared/src/types.ts` if types are not fully inferred.
    - Update `packages/shared/src/zod.ts` if adding new fields that require validation.

3.  **Generate/Push Migration**:
    // turbo
    Run the following command in the root to push schema changes to the database:
    ```bash
    pnpm --filter server db:migrate
    ```

4.  **Verify Backend Integration**:
    Ensure the backend correctly re-exports the updated schema and uses any new Zod validators for request validation.

5.  **Verify Frontend Integration**:
    Update React Query hooks or components to handle new data fields or types.
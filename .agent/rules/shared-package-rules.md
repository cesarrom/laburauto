# Shared Package Rules (@laburauto/shared)

- **Single Source of Truth**: All database schemas, TypeScript types, and Zod validators MUST reside in `packages/shared`.
- **No Duplication**: Never define local interfaces or Zod schemas in `apps/server` or `apps/client` that mirror database entities. Import them from `@laburauto/shared`.
- **Schema Updates**: When modifying the database structure:
    1.  Update `packages/shared/src/schema.ts`.
    2.  Update inferred types in `packages/shared/src/types.ts`.
    3.  Update Zod validators in `packages/shared/src/zod.ts`.
- **Inferred Types**: Use Drizzle's `InferSelectModel` and `InferInsertModel` to generate types automatically in `packages/shared/src/types.ts`.
- **Validation**: Use `drizzle-zod` to create base Zod schemas from Drizzle tables, then extend them with custom validation rules (e.g., regex for Argentine patentes).

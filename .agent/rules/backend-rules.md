# Backend Development Rules

- **Tech Stack**: Node.js, Express 5, Drizzle ORM, PostgreSQL.
- **Database Schema**: Always import and re-export the schema from `@laburauto/shared` in `apps/server/src/db/schema.ts`.
- **Validation**: Use `validateRequest` middleware with Zod schemas from `@laburauto/shared/zod` for all API routes (body, query, and params).
- **Type Safety**: Prefer using `z.infer<typeof schema>` for request payload types instead of manual interfaces.
- **Business Logic**: Separate business logic into services (e.g., `services/openrouter.ts` for AI, `services/bytescale.ts` for uploads).
- **Environment Variables**: Add new configuration to `.env.example` and access via `process.env` (loaded via `dotenv` in `index.ts`).
- **Authentication**: Protect routes using the JWT middleware. Use the user ID from the `req.user` object.
- **Drizzle Kit**: Use `pnpm db:generate` and `pnpm db:push` for managing database changes during development.
- **Documentation**: Follow the [documentation-policy.md](./documentation-policy.md) - prefer "test + docs" pattern in `tests/integration/{domain}/` over separate docs folder.

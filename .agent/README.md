# Antigravity Agent Guidance Configuration

This directory contains rules and workflows to guide the Antigravity agent in maintaining the Laburauto monorepo.

## Structure

- `rules/`: Coding standards, architectural patterns, and project-specific constraints.
- `workflows/`: Multi-step procedures (e.g., migrations, deployments).
- `API_ENDPOINTS.md`: Complete REST API reference.
- `INTEGRATIONS.md`: External service setup (OpenRouter, Bytescale).

## Documentation Policy

Backend feature documentation should be **co-located with integration tests** in `apps/server/tests/integration/{domain}/`. See `rules/documentation-policy.md` for details.

## Key Principles

1.  **Monorepo Consistency**: Use pnpm and maintain the separation between applications (`apps/`) and shared libraries (`packages/`).
2.  **Shared Logic**: `@laburauto/shared` is the source of truth for all data structures.
3.  **UI Components**: Use the established "Building Blocks" for all frontend development to ensure visual and functional consistency.
4.  **Type Safety**: End-to-end type safety using TypeScript and Zod.

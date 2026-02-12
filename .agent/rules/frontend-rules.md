# Frontend Development Rules

- **Tech Stack**: React 19, TypeScript, Tailwind CSS.
- **Data Fetching**: Use `@tanstack/react-query` for all server state management (queries and mutations).
- **Hooks**: Organize React Query logic into custom hooks in `src/hooks/` (e.g., `useVehicles.ts`).
- **Form Handling**: Use `react-hook-form` paired with `zod` resolvers.
- **UI Building Blocks**: Prioritize using established components:
    - `VehicleCard`: Vehicle display.
    - `BookingItem`: Booking status and actions.
    - `ShiftSelector`: Selection of morning/night shifts.
    - `StatusBadge`: Consistent status labels with icons.
- **Responsiveness**: All UI must be mobile-first and responsive. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`).
- **API Client**: Use the centralized Axios instance in `src/lib/api.ts` which handles authentication headers.

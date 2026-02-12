# Backend Documentation Policy

Documentation for backend features should be **co-located with integration tests** rather than in a separate `docs/` folder.

## Structure

```
apps/server/tests/integration/
├── {domain}/
│   ├── *.test.ts           # Integration tests
│   └── YYYY-MM-DD-*.md     # Co-located documentation
```

## Why?

1. **Discoverability**: Tests and docs are in the same place
2. **AI-Friendly**: Context available when working with tests
3. **Living Documentation**: Tests prove docs are accurate
4. **Maintenance**: Update both together when features change

## Documentation Format

Each test folder should have a `YYYY-MM-DD-{domain}.md` file with:

1. **Overview**: What the feature does (with mermaid diagrams)
2. **Tests**: What each test covers
3. **API Endpoints**: Endpoints tested
4. **Related Docs**: Links to other relevant documentation
5. **Running Tests**: Command to run the folder's tests

## Current Test Domains

| Folder | Purpose |
|--------|---------|
| `rental-lifecycle/` | Full rental flow |
| `contracts/` | Multi-stage signing |
| `payments/` | Payment proofs, disputes |
| `bookings/` | Location, cancellation |
| `audit/` | Audit trail logging |
| `auth/` | Magic links |
| `legal/` | Court-ready evidence |
| `photo-audits/` | Check-in/out photos |

## Creating New Documentation

When adding a new feature:

1. Create the integration test in appropriate domain folder
2. Create or update the `YYYY-MM-DD-{domain}.md` file
3. Include diagrams for complex flows
4. Link to related tests in other domains

# Laburauto - Car Rental Marketplace for Work Shifts

A modern SaaS platform for the Argentine market connecting vehicle owners (Publishers) with drivers (Renters) who need vehicles for work (ride-hailing, delivery). Built with React, Node.js, PostgreSQL, and Drizzle ORM in a pnpm monorepo.

## 🏗️ Architecture

### Monorepo Structure (pnpm Workspace)
```
laburauto/
├── apps/
│   ├── client/          # React + Vite frontend
│   └── server/          # Node.js + Express backend
├── packages/
│   └── shared/          # Shared schemas, types, and Zod validators
├── pnpm-workspace.yaml  # Workspace configuration
└── docker-compose.yml   # Local development stack
```

### Technology Stack

**Frontend:**
- React 19 + TypeScript
- React Query (TanStack Query) - Server state management
- React Hook Form + Zod - Form validation
- Tailwind CSS - Styling
- Vite - Build tool
- Leaflet - Maps integration
- Capacitor - Mobile app wrapper

**Backend:**
- Node.js + Express
- PostgreSQL - Database
- Drizzle ORM - Type-safe SQL
- Zod - Runtime validation
- JWT - Authentication

**Shared:**
- Drizzle schema definitions
- TypeScript types (inferred from schema)
- Zod validation schemas for API

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm 8+
- PostgreSQL 15+ (or use Docker)
- (Optional) Docker for containerized development

### Installation

```bash
# Clone repository
git clone <repo-url>
cd laburauto

# Install dependencies
pnpm install

# Set up environment variables
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env and add your API keys

# Run database migrations
cd apps/server
pnpm db:push

# Start development servers (from root)
cd ../..
pnpm dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Using Docker

```bash
docker compose up
```

## 📦 Workspace Packages

### `@laburauto/shared`

Central package containing all shared code:

```typescript
// Schema definitions (Drizzle)
import { users, vehicles, shifts, bookings } from '@laburauto/shared/schema';

// TypeScript types (inferred from schema)
import type { User, Vehicle, Shift, Booking } from '@laburauto/shared/types';

// Zod validators
import { createVehicleSchema, createBookingSchema } from '@laburauto/shared/zod';
```

**Benefits:**
- Single source of truth for data structures
- Type safety across frontend and backend
- Consistent validation rules
- No duplicate type definitions

## 🎯 Core Workflow

1. **Browse & Select**: Drivers browse vehicles with defined shifts (Morning/Night) and prices
2. **Booking**: Driver selects a shift and receives Publisher's payment instructions
3. **Payment Confirmation**: 
   - Driver confirms transfer
   - Publisher receives notification and confirms receipt
4. **Access**: Near shift start, Driver gets vehicle's location
5. **Handoff**: At shift end, Driver either:
   - Returns car to designated spot
   - Hands off directly to next driver
6. **Release**: Driver declares car released to complete shift

## 🔌 Integrations

### Required API Keys

**OpenRouter** (AI Vehicle Detection):
- Sign up: https://openrouter.ai/
- Add to `.env`: `OPENROUTER_API_KEY=sk-or-v1-...`
- Used for: Automatic vehicle detection from photos
- Cost: ~$0.01-0.02 per inference

**Bytescale** (File Uploads):
- Sign up: https://www.bytescale.com/
- Add to `.env`: `BYTESCALE_API_KEY=public_...`
- Used for: Vehicle photos and documents
- Free tier: 5GB storage, 50GB bandwidth/month

## 🗄️ Database Schema

Key tables (see `packages/shared/src/schema.ts` for full schema):

- **users**: Publisher/Driver accounts with KYC and payment details
- **vehicle_models**: 55,000+ Argentine vehicle variants (Make/Model/Version)
- **vehicles**: Published vehicles with photos, location, status
- **shifts**: Morning/Night shift definitions with pricing
- **bookings**: Rental bookings with status workflow
- **notifications**: Real-time user notifications

## 🧩 Key Features

### Publisher Features
- Multi-step vehicle publishing wizard
- AI-powered vehicle detection from photos
- Shift management (Morning/Night)
- Payment details configuration
- Booking confirmations

### Driver Features
- Vehicle search and browse
- Shift-based booking
- Payment workflow
- Real-time notifications
- Booking status tracking

### Technical Features
- **Type-safe API** with shared Zod schemas
- **React Query** for efficient data fetching and caching
- **Form validation** with React Hook Form + Zod
- **Responsive design** for mobile and desktop
- **Privacy-focused location** (fuzzy location with radius)
- **Component library** with reusable building blocks

## 📁 Project Structure

### Frontend (`apps/client/src`)

```
src/
├── components/
│   ├── ui/              # UI primitives (StatusBadge, etc.)
│   ├── vehicles/        # Vehicle components (VehicleCard, ShiftSelector)
│   ├── bookings/        # Booking components (BookingItem)
│   ├── Layout.tsx       # Main layout with sidebar
│   └── Sidebar.tsx      # Navigation sidebar
├── hooks/
│   ├── useVehicles.ts   # Vehicle data hooks
│   └── useBookings.ts   # Booking data hooks
├── pages/
│   ├── Home.tsx         # Vehicle browse
│   ├── MyVehicles.tsx   # Publisher's fleet
│   ├── VehicleDetails.tsx
│   ├── Bookings.tsx     # Driver's rentals
│   └── PublishVehicleWizard.tsx
└── lib/
    └── api.ts           # Axios instance with auth
```

### Backend (`apps/server/src`)

```
src/
├── routes/
│   ├── auth.ts          # Authentication
│   ├── vehicles.ts      # Vehicle CRUD
│   ├── vehicles-db.ts   # Vehicle database queries
│   ├── bookings.ts      # Booking management
│   ├── upload.ts        # File uploads
│   └── ai.ts            # AI inference
├── services/
│   ├── bytescale.ts     # File upload service
│   └── openrouter.ts    # AI service
├── db/
│   └── schema.ts        # Re-exports from @laburauto/shared
└── index.ts
```

### Shared (`packages/shared/src`)

```
src/
├── schema.ts            # Drizzle table definitions
├── types.ts             # TypeScript types (inferred)
├── zod.ts               # Zod validation schemas
└── index.ts             # Main export
```

## 🛠️ Development

### Running Development Servers

```bash
# From root - runs both client and server in parallel
pnpm dev

# Or individually
pnpm --filter @laburauto/client dev
pnpm --filter server dev
```

### Database Commands

```bash
cd apps/server

# Generate migration
pnpm db:generate

# Push schema changes
pnpm db:push

# Run migrations
pnpm db:migrate
```

### Type Checking

```bash
# Check all packages
pnpm -r typecheck

# Check specific package
pnpm --filter @laburauto/shared typecheck
```

## 🎨 Component Architecture

The application uses **building block components** for consistency:

- **VehicleCard**: Reusable vehicle display (browse/manage variants)
- **VehicleGrid**: Responsive grid layout
- **ShiftSelector**: Shift selection UI
- **BookingItem**: Booking card with workflow actions
- **StatusBadge**: Status display with icons
- **FuzzyMap**: Privacy-focused location display

All components use **shared types** from `@laburauto/shared`.

## 🔐 Authentication & Authorization

- JWT-based authentication
- Role-based access (Publisher/Driver)
- Onboarding flow for role selection
- KYC data collection for publishers
- Protected routes with PrivateRoute component

## 📱 Responsive Design

- Mobile-first approach
- Sidebar navigation (drawer on mobile)
- Responsive grids for vehicle listings
- Touch-friendly controls
- Optimized for phones and tablets

## 🚧 Known Issues & Future Enhancements

### Future Features
1. Image optimization before upload
2. Thumbnail generation for list views
3. VIN lookup integration
4. Multiple photo AI processing
5. AI result caching by image hash
6. Real-time WebSocket notifications
7. Geographic filtering
8. Advanced search and filters

## 📝 Environment Variables

### Server (`.env`)
```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/laburauto

# Auth
JWT_SECRET=your-secret-key

# File Uploads
BYTESCALE_API_KEY=public_...

# AI
OPENROUTER_API_KEY=sk-or-v1-...

# Server
PORT=3000

# Docuseal (self-hosted)
DOCUSEAL_ENABLED=true
DOCUSEAL_INTERNAL_URL=http://localhost:3001
DOCUSEAL_PUBLIC_URL=https://sign.your-domain.com
DOCUSEAL_API_KEY=...
DOCUSEAL_WEBHOOK_SECRET=...

# Contract-type -> Docuseal template mapping
DOCUSEAL_TEMPLATE_PUBLISHER_ENROLLMENT_ID=...
DOCUSEAL_TEMPLATE_RENTAL_AGREEMENT_ID=...
```

### Integration tests with Docuseal

- `pnpm --filter=server test:setup` now provisions **both**:
  - PostgreSQL test container (`laburauto-test-db`)
  - Docuseal test container (`laburauto-test-docuseal`)
- The setup script writes:
  - `apps/server/tests/.test-db-url`
  - `apps/server/tests/.test-docuseal-url`
- `setupTestDatabase()` auto-loads both values into `process.env` for integration tests.

## 🤝 Contributing

1. Work in feature branches
2. Update shared types when modifying schema
3. Run type checking before committing
4. Follow existing component patterns
5. Update documentation for significant changes

## 📄 License

[Your License]

---

**Status**: ✅ Production Ready with pnpm Workspace & Shared Types

For detailed integration setup, see archived docs in `/docs` folder.

# Roadmap

Laburauto's core marketplace flow is implemented: publishers list vehicles with shifts, drivers book them, and contracts go through DocuSeal. This file lists what comes next, in rough priority order.

## Next

- [ ] **Booking safety**: check slot availability thoroughly when an application is made (`apps/server/src/routes/applications.ts`), instead of the simple check there today.
- [ ] **Vehicle removal flow**: when a vehicle is deleted or deactivated, cancel its future bookings and handle refunds (`apps/server/src/routes/vehicles.ts`).
- [ ] **Publisher onboarding rule**: a publisher can currently onboard without an active subscription; require one before they can publish a vehicle.
- [ ] **CI**: a GitHub Actions workflow running type checks and the existing server tests on every pull request.

## Later

- [ ] **Photos**: optimize images before upload and generate thumbnails for list views.
- [ ] **AI photo analysis**: process multiple photos per vehicle and cache results by image hash.
- [ ] **VIN lookup** to prefill vehicle details.
- [ ] **Search**: geographic filtering and advanced search filters.
- [ ] **Real-time notifications** over WebSockets.

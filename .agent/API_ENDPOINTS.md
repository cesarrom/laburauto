# Laburauto API Endpoints - Complete Reference

## Overview

This document catalogs all API endpoints available in the Laburauto rental
platform backend.

---

## Authentication (`/api/auth`)

### POST /api/auth/register

Register a new user account.

**Request Body**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

### POST /api/auth/login

Login with email and password.

### PUT /api/auth/role

Change user role (publisher or driver).

---

## Payments (`/api/payments`)

### POST /api/payments/subscribe

Get dLocal subscription URL for publisher.

### POST /api/payments/verify

Verify subscription payment status.

### POST /api/payments/subscriptions/cancel

Cancel publisher subscription.

### POST /api/payments/webhook

dLocal webhook handler.

---

## Vehicles (`/api/vehicles`)

### POST /api/vehicles

Create a new vehicle listing.

### GET /api/vehicles

List all vehicles.

### PUT /api/vehicles/:id/approve ⭐ NEW

Admin approves a vehicle for listing.

### PUT /api/vehicles/:id/reject ⭐ NEW

Admin rejects a vehicle with reason.

### PUT /api/vehicles/:id/maintenance ⭐ NEW

Publisher sets vehicle to maintenance mode.

### PUT /api/vehicles/:id/reactivate ⭐ NEW

Publisher reactivates vehicle from maintenance.

---

## Applications (`/api/applications`)

### POST /api/applications

Renter applies for rental slots.

### GET /api/applications

Get applications (filter by renterId or publisherId).

### GET /api/applications/:id

Get single application with full renter profile.

### PUT /api/applications/:id/approve

Publisher approves application (creates booking).

### PUT /api/applications/:id/reject

Publisher rejects application.

### GET /api/applications/vehicles/:vehicleId/availability

Check slot availability for specific dates.

### GET /api/applications/vehicles/:vehicleId/calendar-availability

Get calendar view of booked slots.

---

## Bookings (`/api/bookings`)

### Core Booking Management

#### POST /api/bookings

Create booking manually.

#### PUT /api/bookings/:id/status

Update booking status.

#### GET /api/bookings

Get user bookings.

---

### Payment Fraud Prevention ⭐ NEW

#### POST /api/bookings/:id/payment/proof

Renter uploads payment proof (receipt screenshot).

**Request Body**:

```json
{
  "proofUrl": "https://storage.example.com/receipt123.jpg"
}
```

#### GET /api/bookings/:id/payment/proof

Get payment proof details.

**Response**:

```json
{
  "paymentProofUrl": "...",
  "paymentConfirmedAt": "2026-01-27T...",
  "disputeStatus": "none"
}
```

#### POST /api/bookings/:id/payment/confirm-receipt

Publisher confirms payment received.

**Request Body**:

```json
{
  "publisherId": 5
}
```

#### POST /api/bookings/:id/payment/dispute

File a payment dispute.

**Request Body**:

```json
{
  "disputeNotes": "Payment was sent but not acknowledged",
  "filedBy": "renter"
}
```

---

### Location Sharing ⭐ NEW

#### GET /api/bookings/:id/vehicle-location

Get vehicle location (time-gated: only available 2 hours before pickup).

**Response (if allowed)**:

```json
{
  "location": {
    "lat": -34.6037,
    "long": -58.3816,
    "address": "Av. Corrientes 1234, Buenos Aires"
  },
  "accessInstructions": "Ring doorbell, ask for Jorge"
}
```

**Response (if too early)**:

```json
{
  "error": "Location not yet available",
  "availableAt": "2026-01-27T10:00:00Z"
}
```

---

### Arrival & Rental Start ⭐ NEW

#### POST /api/bookings/:id/arrive

Renter declares arrival at vehicle location.

**Constraints**: Must be within ±30 minutes of rental start time.

#### POST /api/bookings/:id/start-rental

Activate rental (status → `active`).

---

### Vehicle Return ⭐ NEW

#### POST /api/bookings/:id/return

Renter marks vehicle as returned with photo proof.

**Request Body**:

```json
{
  "returnPhotoUrl": "https://storage.example.com/return-photo.jpg"
}
```

#### POST /api/bookings/:id/return/confirm

Publisher confirms vehicle return in good condition.

**Request Body**:

```json
{
  "publisherId": 5
}
```

---

### Cancellation ⭐ NEW

#### GET /api/bookings/:id/cancellation-eligibility

Check if booking can be cancelled.

**Response**:

```json
{
  "canCancel": true,
  "requiresRefund": true,
  "currentStatus": "confirmed"
}
```

#### POST /api/bookings/:id/cancel-by-publisher

Publisher cancels a booking.

**Request Body**:

```json
{
  "publisherId": 5,
  "reason": "Vehicle requires urgent maintenance"
}
```

**Business Rules**:

- Cannot cancel `active` rentals (requires support)
- `payment_sent`/`confirmed` bookings trigger refunds
- Renter gets notification

---

### Auto-Expiration ⭐ NEW

#### POST /api/bookings/expire-outdated

Cron endpoint to auto-expire bookings past payment deadline.

**Response**:

```json
{
  "expiredCount": 3,
  "bookingIds": [101, 102, 103]
}
```

---

## Renter Documents (`/api/renter-documents`)

### POST /api/renter-documents

Upload verification documents.

### GET /api/renter-documents/:userId

Get verification status.

---

## Notifications (`/api/notifications`)

### GET /api/notifications

Get user notifications.

### PUT /api/notifications/:id/read

Mark notification as read.

---

## Legend

- ⭐ NEW: Newly implemented endpoint (16 total)
- All endpoints return JSON
- Error responses follow format: `{ "error": "Error message" }`

---

## Next Implementation

These endpoints are planned but not yet implemented:

- Direct driver handoff (4 endpoints)
- Ratings system (3 endpoints)
- Rental extensions (2 endpoints)
- Emergency SOS (2 endpoints)

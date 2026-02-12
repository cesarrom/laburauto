# Legal Disputes

This folder contains integration tests for legal dispute scenarios, ensuring the platform can provide court-ready evidence.

## Overview

Under Argentine law, electronic signatures require proof of:
1. **Identity**: The person who signed IS who they claim to be
2. **Intent**: The person deliberately agreed to the terms
3. **Integrity**: The document has not been altered since signing

These tests simulate real court scenarios and verify our audit trail provides **impartial, immutable** evidence.

## Test Scenarios

### `dispute-scenarios.test.ts`

| Scenario | Description |
|----------|-------------|
| Payment Dispute | Renter claims payment, publisher denies |
| Vehicle Damage | Publisher claims damage at return |
| Contract Signing | Verify signature chain of custody |
| Email Identity | Prove same person accessed email and signed |

## Evidence Components

### 1. Audit Logs

Every action creates an immutable audit record:

```json
{
  "action": "booking.dispute_filed",
  "entityType": "booking",
  "entityId": 123,
  "details": {
    "filedBy": "renter",
    "disputeNotes": "I sent payment but publisher denies",
    "paymentProofHash": "sha256:abc123..."
  },
  "metadata": {
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (iPhone...)",
    "timestamp": "2026-02-02T14:30:00Z"
  }
}
```

### 2. Document Hashing

| Document | Hash Storage |
|----------|-------------|
| Payment proof | `bookings.paymentProofHash` |
| Contract PDF | `audit_logs.details.pdfHash` |
| Check-in photos | `photo_audits.photoHashes` |
| Check-out photos | `photo_audits.photoHashes` |

### 3. Email Tracking

Proves the recipient accessed their email:

| Event | Recorded |
|-------|----------|
| Email sent | `notificationLogs.sentAt` |
| Email opened | `contractInstances.emailOpenedAt` |
| Magic link used | `magicLinks.usedAt` + audit log |

## Dispute Types

### Payment Dispute

**Claim**: "I paid but publisher says they didn't receive it"

**Evidence**:
- `paymentProofUrl` - Screenshot of transfer
- `paymentProofHash` - SHA-256 proves no tampering
- Audit timeline shows when proof was uploaded

### Vehicle Damage Dispute

**Claim**: "The vehicle was already damaged when I got it"

**Evidence**:
- Check-in photos with hashes and timestamp
- Check-out photos with hashes and timestamp
- Odometer readings at both points
- Live capture metadata (not from gallery)

### Contract Dispute

**Claim**: "I never signed that contract"

**Evidence**:
- Stage 1 audit log (publisher IP, UA, timestamp, PDF hash)
- Magic link sent to registered email
- Email tracking pixel confirms access
- Stage 2 audit log (renter IP, UA, timestamp, PDF hash)
- Final PDF hash matches

## API Endpoints Tested

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/audit-report/booking/:id` | GET | Complete audit timeline |
| `/api/admin/evidence-kit/:id` | GET | Consolidated evidence package |

## Audit Report Response

```json
{
  "reportGeneratedAt": "2026-02-02T17:00:00Z",
  "booking": { "id": 123, "status": "disputed" },
  "parties": {
    "renter": { "id": 1, "name": "Alice", "email": "..." },
    "publisher": { "id": 2, "name": "John", "email": "..." }
  },
  "timeline": [
    { "action": "booking.create", "timestamp": "...", "metadata": {...} },
    { "action": "booking.payment_proof_uploaded", "details": { "hash": "..." } },
    { "action": "booking.dispute_filed", "details": { "filedBy": "renter" } }
  ],
  "documents": {
    "paymentProof": { "url": "...", "hash": "..." },
    "contract": { "url": "...", "hash": "..." }
  }
}
```

## Related Documentation

- [LEGAL_DISPUTE_AUDIT_TRAIL.md](/docs/LEGAL_DISPUTE_AUDIT_TRAIL.md) - Full legal compliance docs
- [AUDIT_COMPLIANCE.md](/docs/AUDIT_COMPLIANCE.md) - Audit system overview

## Running Tests

```bash
cd apps/server
pnpm test tests/integration/legal
```

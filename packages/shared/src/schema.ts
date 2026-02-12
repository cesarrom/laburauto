import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision, uuid, jsonb, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { Field, Stage } from './signer';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['publisher', 'driver', 'admin'] }), // Add admin role
  onboardingCompleted: boolean('onboarding_completed').default(false),
  kycData: text('kyc_data'), // JSON string for KYC information
  reputationScore: integer('reputation_score').default(100), // Starting score
  enrollmentContractId: integer('enrollment_contract_id'), // FK to contract_instances
  paymentDetails: text('payment_details'),
  createdAt: timestamp('created_at').defaultNow(),

  // dLocal Subscription Info
  dlocalCustomerId: text('dlocal_customer_id'),
  subscriptionStatus: text('subscription_status', { enum: ['active', 'inactive', 'past_due', 'canceled'] }).default('inactive'),
  subscriptionId: text('subscription_id'),

  // Bank Account Info (for future split payments)
  bankAccountCbu: text('bank_account_cbu'),
  bankAccountHolder: text('bank_account_holder'),
  bankName: text('bank_name'),

  // Emergency Contact
  emergencyPhone: text('emergency_phone'),
});

export const vehicleModels = pgTable('vehicle_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  typeName: text('type_name').notNull(),
  typeId: integer('type_id').notNull(),
  brandName: text('brand_name').notNull(),
  brandId: integer('brand_id').notNull(),
  modelName: text('model_name').notNull(),
  modelId: integer('model_id').notNull(),
  versionName: text('version_name').notNull(),
  versionId: integer('version_id').notNull(),
});

export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  publisherId: integer('publisher_id').references(() => users.id).notNull(),

  // Photos
  photos: jsonb('photos').$type<string[]>(), // JSON array of photo URLs
  documentUrls: jsonb('document_urls').$type<string[]>(), // JSON array of document URLs

  // Vehicle Info
  vehicleModelId: uuid('vehicle_model_id').references(() => vehicleModels.id).notNull(),
  year: integer('year').notNull(),
  plate: text('plate').notNull(), // "Patente" in Argentina
  mileage: integer('mileage').notNull(),
  color: text('color'),

  description: text('description').notNull(),

  // Location
  idleLat: doublePrecision('idle_lat'),
  idleLong: doublePrecision('idle_long'),
  idleAddress: text('idle_address'),

  // Access Instructions
  accessInstructions: text('access_instructions'),

  // Payment Instructions
  paymentInstructions: text('payment_instructions'),

  status: text('status', { enum: ['pending_review', 'active', 'rented', 'maintenance', 'rejected'] }).default('pending_review'),
  createdAt: timestamp('created_at').defaultNow(),

  // Odometer & Maintenance
  lastOdometer: integer('last_odometer').default(0),
  nextServiceOdometer: integer('next_service_odometer'),

  // Admin Approval
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
});

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  type: text('type', { enum: ['morning', 'night'] }).notNull(),
  price: integer('price').notNull(), // Cents or whole numbers? Assuming whole numbers for now
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(), // HH:mm
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  driverId: integer('driver_id').references(() => users.id).notNull(),
  applicationId: integer('application_id').references(() => rentalApplications.id),
  // Date range for the rental
  startDate: text('start_date').notNull(), // ISO date string
  endDate: text('end_date').notNull(), // ISO date string
  selectedShiftIds: jsonb('selected_shift_ids').notNull(), // JSON array matching dates
  totalPrice: integer('total_price').notNull(),
  // Payment deadline
  paymentDeadline: timestamp('payment_deadline'),
  status: text('status', { enum: ['pending_publisher_signature', 'pending_renter_signature', 'pending_payment', 'payment_sent', 'confirmed', 'active', 'completed', 'cancelled', 'expired'] }).default('pending_publisher_signature'),
  contractId: integer('contract_id'), // Multi-party contract instance id
  contractSignedAt: timestamp('contract_signed_at'),
  contractFullySigned: boolean('contract_fully_signed').default(false),
  createdAt: timestamp('created_at').defaultNow(),

  // Payment Fraud Prevention
  paymentProofUrl: text('payment_proof_url'), // Receipt/transfer screenshot
  paymentProofHash: text('payment_proof_hash'), // SHA-256 hash of proof image
  paymentConfirmedAt: timestamp('payment_confirmed_at'),
  disputeStatus: text('dispute_status', { enum: ['none', 'pending', 'resolved_renter', 'resolved_publisher'] }).default('none'),
  disputeNotes: text('dispute_notes'),

  // Location Sharing
  locationSharedAt: timestamp('location_shared_at'),
  renterCanSeeLocation: boolean('renter_can_see_location').default(false),

  // Arrival & Rental Start
  arrivedAt: timestamp('arrived_at'),
  rentalStartedAt: timestamp('rental_started_at'),

  // Direct Handoff
  handoffType: text('handoff_type', { enum: ['idle_location', 'direct_driver'] }).default('idle_location'),
  handoffLocation: text('handoff_location'),
  handoffLat: doublePrecision('handoff_lat'),
  handoffLong: doublePrecision('handoff_long'),
  handoffCompletedAt: timestamp('handoff_completed_at'),

  // Vehicle Return
  returnedAt: timestamp('returned_at'),
  returnConfirmedAt: timestamp('return_confirmed_at'),
  returnPhotoUrl: text('return_photo_url'),

  // Cancellation
  cancelledBy: text('cancelled_by', { enum: ['renter', 'publisher', 'system'] }),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at'),
  refundStatus: text('refund_status', { enum: ['none', 'pending', 'processed'] }).default('none'),

  // Extension
  extensionRequested: boolean('extension_requested').default(false),
  extensionEndDate: text('extension_end_date'),
  extensionPrice: integer('extension_price'),

  // Case for Emergency
  emergencyTriggeredAt: timestamp('emergency_triggered_at'),
  emergencyNotes: text('emergency_notes'),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // e.g., 'booking_update', 'payment_received'
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false),
  relatedEntityId: integer('related_entity_id'), // Generic reference ID
  createdAt: timestamp('created_at').defaultNow(),
});

export const renterDocuments = pgTable('renter_documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  uberRating: text('uber_rating'), // URL to document
  cabifyRating: text('cabify_rating'), // URL to document
  indriveRating: text('indrive_rating'), // URL to document
  didiRating: text('didi_rating'), // URL to document
  dniPhoto: text('dni_photo').notNull(), // Photo of DNI (ID card) - REQUIRED
  criminalBackground: text('criminal_background').notNull(), // URL to document - REQUIRED
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const rentalApplications = pgTable('rental_applications', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  renterId: integer('renter_id').references(() => users.id).notNull(),
  // Multi-slot/multi-day support
  selectedDates: jsonb('selected_dates').$type<string[]>().notNull(), // JSON array of date strings ["2026-01-25", "2026-01-26"]
  selectedShiftIds: jsonb('selected_shift_ids').$type<number[]>().notNull(), // JSON array of shift IDs [1, 1, 2]
  totalPrice: integer('total_price').notNull(),
  // Status and deadlines
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'expired'] }).default('pending'),
  paymentDeadline: timestamp('payment_deadline'),
  createdAt: timestamp('created_at').defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

export const publisherDocuments = pgTable('publisher_documents', {
  id: serial('id').primaryKey(),
  publisherId: integer('publisher_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  registrationCertificate: text('registration_certificate').notNull(),
  proofOfInsurance: text('proof_of_insurance').notNull(),
  technicalInspection: text('technical_inspection'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniquePublisherVehicle: unique('unique_publisher_vehicle').on(t.publisherId, t.vehicleId),
}));


export const contractTemplates = pgTable('contract_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['publisher_enrollment', 'rental_agreement'] }).notNull(),
  pdfUrl: text('pdf_url').notNull(),
  fields: jsonb('fields').$type<Field[]>().notNull(), // Field definitions for the SDK
  stages: jsonb('stages').$type<Stage[]>().notNull(), // Stage definitions for the SDK
  variableSchema: jsonb('variable_schema'), // Available variables for this template type
  createdAt: timestamp('created_at').defaultNow(),
});

export const contractInstances = pgTable('contract_instances', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').references(() => contractTemplates.id).notNull(),
  status: text('status', { enum: ['pending', 'signed', 'void'] }).default('pending'),
  finalPdfUrl: text('final_pdf_url'), // Signed PDF
  auditLog: jsonb('audit_log').notNull().default([]), // List of signing events
  variableValues: jsonb('variable_values'), // Actual values used for this instance
  publisherId: integer('publisher_id').references(() => users.id),
  renterId: integer('renter_id').references(() => users.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  stage1CompletedAt: timestamp('stage_1_completed_at'),
  stage1CompletedBy: integer('stage_1_completed_by').references(() => users.id),
  stage2CompletedAt: timestamp('stage_2_completed_at'),
  stage2CompletedBy: integer('stage_2_completed_by').references(() => users.id),
  stage3CompletedAt: timestamp('stage_3_completed_at'),
  stage3CompletedBy: integer('stage_3_completed_by').references(() => users.id),
  emailSentAt: timestamp('email_sent_at'),
  emailOpenedAt: timestamp('email_opened_at'),
  createdAt: timestamp('created_at').defaultNow(),
  signedAt: timestamp('signed_at'),
});

export const photoAudits = pgTable('photo_audits', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id).notNull(),
  type: text('type', { enum: ['check_in', 'check_out'] }).notNull(),
  photos: jsonb('photos').notNull(), // Array of photos with metadata
  photoHashes: jsonb('photo_hashes').$type<string[]>(), // SHA-256 hashes of each photo
  odometerReading: integer('odometer_reading').notNull(),
  metadata: jsonb('metadata'), // Consolidated EXIF/GPS data
  createdAt: timestamp('created_at').defaultNow(),
});

// Ratings table for post-rental reviews
export const ratings = pgTable('ratings', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').references(() => bookings.id).notNull(),
  reviewerId: integer('reviewer_id').references(() => users.id).notNull(),
  revieweeId: integer('reviewee_id').references(() => users.id).notNull(),
  rating: integer('rating').notNull(), // 1-5
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id), // Nullable for system actions or failed logins (if we track them by email/ip)
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  details: jsonb('details'),
  metadata: jsonb('metadata'), // IP, UserAgent, etc.
  createdAt: timestamp('created_at').defaultNow(),
});

export const magicLinks = pgTable('magic_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  redirectPath: text('redirect_path').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  vehicles: many(vehicles),
  bookingsAsDriver: many(bookings, { relationName: 'driverBookings' }),
  notifications: many(notifications),
  ratingsGiven: many(ratings, { relationName: 'reviewerRatings' }),
  ratingsReceived: many(ratings, { relationName: 'revieweeRatings' }),
  enrollmentContract: one(contractInstances, {
    fields: [users.enrollmentContractId],
    references: [contractInstances.id],
  }),
  magicLinks: many(magicLinks),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  publisher: one(users, {
    fields: [vehicles.publisherId],
    references: [users.id],
  }),
  vehicleModel: one(vehicleModels, {
    fields: [vehicles.vehicleModelId],
    references: [vehicleModels.id],
  }),
  shifts: many(shifts),
  bookings: many(bookings),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [shifts.vehicleId],
    references: [vehicles.id],
  }),
  // Shifts no longer have direct booking relation (bookings use multiple shifts)
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [bookings.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(users, {
    fields: [bookings.driverId],
    references: [users.id],
    relationName: 'driverBookings',
  }),
  application: one(rentalApplications, {
    fields: [bookings.applicationId],
    references: [rentalApplications.id],
  }),
  contract: one(contractInstances, {
    fields: [bookings.contractId],
    references: [contractInstances.id],
  }),
  ratings: many(ratings),
  photoAudits: many(photoAudits),
}));

export const contractTemplatesRelations = relations(contractTemplates, ({ many }) => ({
  instances: many(contractInstances),
}));

export const contractInstancesRelations = relations(contractInstances, ({ one }) => ({
  template: one(contractTemplates, {
    fields: [contractInstances.templateId],
    references: [contractTemplates.id],
  }),
}));

export const photoAuditsRelations = relations(photoAudits, ({ one }) => ({
  booking: one(bookings, {
    fields: [photoAudits.bookingId],
    references: [bookings.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const renterDocumentsRelations = relations(renterDocuments, ({ one }) => ({
  user: one(users, {
    fields: [renterDocuments.userId],
    references: [users.id],
  }),
}));

export const rentalApplicationsRelations = relations(rentalApplications, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [rentalApplications.vehicleId],
    references: [vehicles.id],
  }),
  renter: one(users, {
    fields: [rentalApplications.renterId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  booking: one(bookings, {
    fields: [ratings.bookingId],
    references: [bookings.id],
  }),
  reviewer: one(users, {
    fields: [ratings.reviewerId],
    references: [users.id],
    relationName: 'reviewerRatings',
  }),
  reviewee: one(users, {
    fields: [ratings.revieweeId],
    references: [users.id],
    relationName: 'revieweeRatings',
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const magicLinksRelations = relations(magicLinks, ({ one }) => ({
  user: one(users, {
    fields: [magicLinks.userId],
    references: [users.id],
  }),
}));

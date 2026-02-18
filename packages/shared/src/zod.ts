import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import * as schema from './schema';

// User schemas
export const insertUserSchema = createInsertSchema(schema.users, {
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export const selectUserSchema = createSelectSchema(schema.users);

export const safeUserSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  email: z.string().email(),
  role: z.enum(['admin', 'publisher', 'driver']),
  onboardingCompleted: z.boolean(),
  enrollmentContractId: z.number().nullable().optional(),
});

export const publicUserSchema = safeUserSchema;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: safeUserSchema,
  redirectPath: z.string().optional(),
});
export const vehiclePlateSchema = z.string()
  .min(6, 'Patente must be at least 6 characters')
  .max(7, 'Patente must be at most 7 characters')
  .regex(/^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/i, 'Invalid patente format (e.g., AB123CD or ABC123)')
  .transform(val => val.toUpperCase());

export const insertVehicleSchema = createInsertSchema(schema.vehicles, {
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(new Date().getFullYear() + 1),
  mileage: z.number().int().min(0).max(999999, 'Mileage seems too high'),
  plate: vehiclePlateSchema,
  description: z.string().min(20, 'Description must be at least 20 characters').max(1000),
  color: z.string().min(1, 'Color is required'),
});

export const selectVehicleSchema = createSelectSchema(schema.vehicles);

export const createVehicleSchema = insertVehicleSchema.omit({
  id: true,
  createdAt: true,
  status: true,
});

// Shift schemas
export const insertShiftSchema = createInsertSchema(schema.shifts, {
  price: z.number().int().min(100, 'Price must be at least 100 ARS').max(1000000),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
});

export const selectShiftSchema = createSelectSchema(schema.shifts);

export const createShiftSchema = insertShiftSchema.omit({
  id: true,
});

// Location schemas
export const locationSchema = z.object({
  address: z.string().min(10, 'Address must be at least 10 characters'),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

// Booking schemas
export const insertBookingSchema = createInsertSchema(schema.bookings);
export const selectBookingSchema = createSelectSchema(schema.bookings);

export const createBookingSchema = z.object({
  vehicleId: z.number(),
  selectedShiftIds: z.array(z.number()).min(1, 'At least one shift is required'),
  startDate: z.string(),
  endDate: z.string(),
  totalPrice: z.number().positive(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['pending_payment', 'payment_sent', 'confirmed', 'active', 'completed', 'cancelled']),
});

export const createRentalApplicationSchema = z.object({
  vehicleId: z.number(),
  selectedDates: z.array(z.string()).min(1, 'At least one rental date is required'),
  selectedShiftIds: z.array(z.number()),
}).refine(data => data.selectedShiftIds.length === data.selectedDates.length, {
  message: 'Shift IDs must match the number of dates',
  path: ['selectedShiftIds'],
});

export const publishVehicleSchema = z.object({
  vehicleModelId: z.string(),
  year: z.number().int().min(2000).max(new Date().getFullYear() + 1),
  plate: vehiclePlateSchema,
  mileage: z.number().int().min(0).max(999999),
  color: z.string().min(1),
  description: z.string().min(20),
  photos: z.array(z.string()).min(1),
  documentUrls: z.array(z.string()).optional(),
  idleLat: z.number().optional(),
  idleLong: z.number().optional(),
  idleAddress: z.string().optional(),
  accessInstructions: z.string().optional(),
  paymentInstructions: z.string().min(20),
  registrationCertificate: z.string().min(1),
  proofOfInsurance: z.string().min(1),
  technicalInspection: z.string().min(1),
  shifts: z.array(z.object({
    type: z.enum(['morning', 'night', 'custom']),
    price: z.number().int().min(100),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  })).min(1),
});

// Document schemas
export const renterDocumentsSchema = z.object({
  uberRating: z.string().optional(),
  cabifyRating: z.string().optional(),
  indriveRating: z.string().optional(),
  didiRating: z.string().optional(),
  dniPhoto: z.string().min(1, 'DNI photo is required'),
  criminalBackground: z.string().min(1, 'Criminal background check is required'),
}).refine(
  (data) => !!(data.uberRating || data.cabifyRating || data.indriveRating || data.didiRating),
  { message: 'At least one ride-share rating is required', path: ['uberRating'] }
);

export const publisherDocumentsSchema = z.object({
  registrationCertificate: z.string().min(1, 'Registration certificate (Cédula) is required'),
  proofOfInsurance: z.string().min(1, 'Proof of insurance is required'),
  technicalInspection: z.string().min(1, 'VTV (Technical Inspection) is required'),
});

// Onboarding schemas
export const kycSchema = z.object({
  fullName: z.string().min(3, 'Full name is required'),
  idNumber: z.string().min(7, 'ID number must be at least 7 characters'),
  dateOfBirth: z.string().refine((date) => {
    const dob = new Date(date);
    const age = new Date().getFullYear() - dob.getFullYear();
    return age >= 18;
  }, 'Must be at least 18 years old'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  phone: z.string().regex(/^\+?[0-9\s\-()]{8,}$/, 'Invalid phone number'),
});

export const completeOnboardingSchema = z.object({
  userId: z.number(),
  role: z.enum(['publisher', 'driver']),
  kycData: z.string(),
});

export const resendEnrollmentSchema = z.object({});

// Contract Template & Signing schemas
export const createTemplateSchema = z.object({
  name: z.string().min(3),
  type: z.enum(['rental_agreement', 'publisher_enrollment']),
  pdfUrl: z.string().min(1),
  fields: z.any(),
  stages: z.any(),
  variableSchema: z.any().optional(),
});

export const signContractSchema = z.object({
  finalPdfUrl: z.string().optional(),
  auditEvent: z.object({
    isFinal: z.boolean(),
    userId: z.number(),
    action: z.string(),
    timestamp: z.string(),
  }).optional(),
  fields: z.any().optional(),
});

export const selectContractTemplateSchema = createSelectSchema(schema.contractTemplates);
export const selectContractInstanceSchema = createSelectSchema(schema.contractInstances);

import { z } from 'zod';

// Vehicle Info Schema
export const vehicleInfoSchema = z.object({
  year: z.number()
    .min(2000, 'Year must be 2000 or later')
    .max(new Date().getFullYear() + 1, 'Year cannot be in the future'),
  brand: z.string()
    .min(1, 'Brand is required'),
  model: z.string()
    .min(1, 'Model is required'),
  version: z.string()
    .min(1, 'Version is required'),
  vehicleModelId: z.string().optional(), // Will be populated when version is selected
  plate: z.string()
    .min(6, 'Patente must be at least 6 characters')
    .max(7, 'Patente must be at most 7 characters')
    .regex(/^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/i, 'Invalid patente format (e.g., AB123CD or ABC123)')
    .transform(val => val.toUpperCase()),
  mileage: z.number()
    .min(0, 'Mileage cannot be negative')
    .max(999999, 'Mileage seems too high'),
  color: z.string()
    .min(1, 'Color is required'),
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(1000, 'Description must be less than 1000 characters'),
});

export type VehicleInfoData = z.infer<typeof vehicleInfoSchema>;

// Shift Schema
export const shiftSchema = z.object({
  type: z.enum(['morning', 'night', 'custom']),
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  price: z.number()
    .min(100, 'Price must be at least 100 ARS')
    .max(100000, 'Price seems too high'),
});

export type ShiftData = z.infer<typeof shiftSchema>;

// Location Schema
export const locationSchema = z.object({
  address: z.string()
    .min(10, 'Address must be at least 10 characters'),
  lat: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude')
    .nullable()
    .optional(),
  long: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude')
    .nullable()
    .optional(),
});

export type LocationData = z.infer<typeof locationSchema>;

// Access Instructions Schema
export const accessSchema = z.object({
  instructions: z.string()
    .min(30, 'Instructions must be at least 30 characters')
    .max(500, 'Instructions must be less than 500 characters'),
  paymentInstructions: z.string()
    .min(20, 'Payment instructions must be at least 20 characters')
    .max(500, 'Payment instructions must be less than 500 characters'),
});

export type AccessData = z.infer<typeof accessSchema>;

// KYC Schema (for onboarding)
export const kycSchema = z.object({
  fullName: z.string()
    .min(3, 'Full name is required'),
  idNumber: z.string()
    .min(7, 'ID number must be at least 7 characters'),
  dateOfBirth: z.string()
    .refine((date) => {
      const dob = new Date(date);
      const age = new Date().getFullYear() - dob.getFullYear();
      return age >= 18;
    }, 'Must be at least 18 years old'),
  address: z.string()
    .min(10, 'Address must be at least 10 characters'),
  phone: z.string()
    .regex(/^\+?[0-9\s\-()]{8,}$/, 'Invalid phone number'),
});

export type KYCData = z.infer<typeof kycSchema>;

// Registration Schema
export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters'),
  email: z.string()
    .email('Invalid email address'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type RegisterData = z.infer<typeof registerSchema>;

// Renter Documents Schema
export const renterDocumentsSchema = z.object({
  uberRating: z.string().optional(),
  cabifyRating: z.string().optional(),
  indriveRating: z.string().optional(),
  didiRating: z.string().optional(),
  dniPhoto: z.string().min(1, 'DNI photo is required'),
  criminalBackground: z.string().min(1, 'Criminal background check is required'),
}).refine(
  (data) => {
    // At least one ride-share rating must be provided (non-empty)
    return !!(
      (data.uberRating && data.uberRating.length > 0) ||
      (data.cabifyRating && data.cabifyRating.length > 0) ||
      (data.indriveRating && data.indriveRating.length > 0) ||
      (data.didiRating && data.didiRating.length > 0)
    );
  },
  {
    message: 'At least one ride-share rating is required',
    path: ['uberRating']
  }
);

export type RenterDocumentsData = z.infer<typeof renterDocumentsSchema>;

// Publisher Documents Schema (for vehicle publishing)
export const publisherDocumentsSchema = z.object({
  registrationCertificate: z.string().min(1, 'Registration certificate (Cédula) is required'),
  proofOfInsurance: z.string().min(1, 'Proof of insurance is required'),
  technicalInspection: z.string().min(1, 'VTV (Technical Inspection) is required'),
});

export type PublisherDocumentsData = z.infer<typeof publisherDocumentsSchema>;

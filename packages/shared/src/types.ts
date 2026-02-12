import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema';

// Inferred types from Drizzle schema
export type User = InferSelectModel<typeof schema.users>;
export type InsertUser = InferInsertModel<typeof schema.users>;

export type VehicleModel = InferSelectModel<typeof schema.vehicleModels>;
export type InsertVehicleModel = InferInsertModel<typeof schema.vehicleModels>;

export type Vehicle = InferSelectModel<typeof schema.vehicles>;
export type InsertVehicle = InferInsertModel<typeof schema.vehicles>;

export type Shift = InferSelectModel<typeof schema.shifts>;
export type InsertShift = InferInsertModel<typeof schema.shifts>;

export type Booking = InferSelectModel<typeof schema.bookings>;
export type InsertBooking = InferInsertModel<typeof schema.bookings>;

export type Notification = InferSelectModel<typeof schema.notifications>;
export type InsertNotification = InferInsertModel<typeof schema.notifications>;

export type RenterDocument = InferSelectModel<typeof schema.renterDocuments>;
export type InsertRenterDocument = InferInsertModel<typeof schema.renterDocuments>;

export type RentalApplication = InferSelectModel<typeof schema.rentalApplications>;
export type InsertRentalApplication = InferInsertModel<typeof schema.rentalApplications>;

// Enum types
export type UserRole = NonNullable<User['role']>;
export type VehicleStatus = NonNullable<Vehicle['status']>;
export type ShiftType = Shift['type'];
export type BookingStatus = NonNullable<Booking['status']>; // Now includes 'expired'
export type ApplicationStatus = NonNullable<RentalApplication['status']>; // Now includes 'expired'

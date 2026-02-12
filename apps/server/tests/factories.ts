
// Basic factories for creating test objects
// Using Partial<T> to allow overriding defaults

export const createTestUser = (overrides: any = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed_password_123',
  role: 'driver',
  onboardingCompleted: true,
  createdAt: new Date(),
  subscriptionStatus: 'inactive',
  ...overrides,
});

export const createTestVehicle = (overrides: any = {}) => ({
  id: 1,
  publisherId: 100,
  vehicleModelId: 'uuid-1234',
  year: 2022,
  plate: 'AA123BB',
  mileage: 15000,
  description: 'A great car',
  status: 'active',
  createdAt: new Date(),
  ...overrides,
});

export const createTestShift = (overrides: any = {}) => ({
  id: 1,
  vehicleId: 1,
  type: 'morning',
  price: 5000,
  startTime: '08:00',
  endTime: '16:00',
  ...overrides,
});

export const createTestRentalApplication = (overrides: any = {}) => ({
  id: 1,
  vehicleId: 1,
  renterId: 1,
  selectedDates: ['2026-02-01'],
  selectedShiftIds: [1],
  totalPrice: 5000,
  status: 'pending',
  createdAt: new Date(),
  ...overrides,
});

export const createTestBooking = (overrides: any = {}) => ({
  id: 1,
  vehicleId: 1,
  driverId: 1,
  applicationId: 1,
  startDate: '2026-02-01',
  endDate: '2026-02-01',
  selectedShiftIds: [1],
  totalPrice: 5000,
  status: 'pending_payment',
  createdAt: new Date(),
  ...overrides,
});

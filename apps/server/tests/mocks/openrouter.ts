
import { vi } from 'vitest';

export const inferVehicleFromImage = vi.fn().mockResolvedValue({
  make: 'Toyota',
  model: 'Corolla',
  year: 2020,
  color: 'White',
  confidence: 0.95,
});

import { useVehicles } from '../hooks/useVehicles';
import VehicleGrid from '../components/vehicles/VehicleGrid';
import VehicleCard from '../components/vehicles/VehicleCard';

export default function Home() {
  const { data: vehicles, isLoading } = useVehicles();

  if (isLoading) return <div className="text-center py-10">Loading vehicles...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Available Vehicles</h1>

      <VehicleGrid>
        {vehicles?.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} variant="browse" />
        ))}
      </VehicleGrid>

      {vehicles?.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No vehicles available at the moment.
        </div>
      )}
    </div>
  );
}

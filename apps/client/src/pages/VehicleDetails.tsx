import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FuzzyMap from '../components/FuzzyMap';
import DateShiftSelector from '../components/DateShiftSelector';
import { useVehicle } from '../hooks/useVehicles';
import { useCreateApplication } from '../hooks/useApi';

export default function VehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activePhoto, setActivePhoto] = useState(0);

  const { data: vehicle, isLoading } = useVehicle(id!);
  const createApplicationMutation = useCreateApplication();

  const handleApplicationSubmit = async (selectedDates: string[], selectedShiftIds: number[], totalPrice: number) => {
    if (!user || !vehicle) return;

    try {
      await createApplicationMutation.mutateAsync({
        vehicleId: vehicle.id,
        renterId: user.id,
        selectedDates,
        selectedShiftIds,
      });

      alert(`Application submitted successfully! Total: $${totalPrice}\n\nThe vehicle owner will review your application and you'll be notified.`);
      navigate('/');
    } catch (error: any) {
      console.error('Application failed', error);
      alert(error.response?.data?.error || 'Failed to submit application');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="text-xl">Loading...</div></div>;
  if (!vehicle) return <div className="flex items-center justify-center min-h-screen"><div className="text-xl">Vehicle not found</div></div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
        {/* Photo Gallery */}
        <div className="relative h-96 bg-gray-100">
          {vehicle.photos && vehicle.photos.length > 0 ? (
            <>
              <img
                src={vehicle.photos[activePhoto]}
                alt={`${vehicle.make} ${vehicle.model}`}
                className="w-full h-full object-cover"
              />
              {vehicle.photos.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {vehicle.photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhoto(idx)}
                      className={`w-3 h-3 rounded-full ${idx === activePhoto ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <span className="text-2xl font-bold">No Photos Available</span>
            </div>
          )}
        </div>

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{vehicle.make} {vehicle.model}</h1>
              <p className="text-xl text-gray-600">{vehicle.year} • {vehicle.color}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Plate: {vehicle.plate}</p>
              <p className="text-sm text-gray-500">{vehicle.mileage.toLocaleString()} km</p>
            </div>
          </div>

          <div className="flex items-center text-gray-500 mb-6">
            <MapPin className="h-5 w-5 mr-2" />
            <span>Approximate Location (~{vehicle.radius}m radius)</span>
          </div>

          <FuzzyMap
            lat={vehicle.approxLat}
            lng={vehicle.approxLng}
            radius={vehicle.radius}
            className="h-64 w-full mb-8 rounded-xl shadow-sm"
          />

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">About this vehicle</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{vehicle.description}</p>
          </div>
        </div>
      </div>

      {/* Calendar Selector */}
      <DateShiftSelector
        vehicleId={vehicle.id}
        shifts={vehicle.shifts || []}
        onComplete={handleApplicationSubmit}
      />
    </div>
  );
}

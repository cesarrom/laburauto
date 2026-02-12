import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../hooks/useVehicles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import VehicleGrid from '../components/vehicles/VehicleGrid';
import VehicleCard from '../components/vehicles/VehicleCard';
import EditVehicleModal from '../components/modals/EditVehicleModal';

export default function MyVehicles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: vehiclesData, isLoading } = useVehicles(user?.id);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);

  // Filter client side (since API returns all)
  // Ideally API should support filtering
  const myVehicles = vehiclesData?.filter(v => v.publisherId === user?.id) || [];

  const updateMediaMutation = useMutation({
    mutationFn: async (data: { vehicleId: number; photos: string[]; documents: string[]; description: string; paymentInstructions: string; accessInstructions: string }) => {
      const response = await api.put(`/vehicles/${data.vehicleId}/media`, {
        publisherId: user?.id,
        photos: data.photos,
        documentUrls: data.documents,
        description: data.description,
        paymentInstructions: data.paymentInstructions,
        accessInstructions: data.accessInstructions,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setEditingVehicle(null);
      alert('Vehicle updated successfully');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update vehicle');
    }
  });

  const handleSaveMedia = (data: { photos: string[]; documents: string[]; description: string; paymentInstructions: string; accessInstructions: string }) => {
    if (!editingVehicle) return;
    updateMediaMutation.mutate({
      vehicleId: editingVehicle.id,
      ...data
    });
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading your vehicles...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Vehicles</h1>
          <p className="text-gray-500">Manage your fleet and check review status.</p>
        </div>
        <Link
          to="/publish-vehicle"
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          Add Vehicle
        </Link>
      </div>

      {myVehicles.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No vehicles added</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by publishing your first vehicle.</p>
          <div className="mt-6">
            <Link
              to="/publish-vehicle"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Plus size={16} />
              Publish Vehicle
            </Link>
          </div>
        </div>
      ) : (
        <VehicleGrid>
          {myVehicles.map((vehicle) => (
            <div key={vehicle.id} className="relative">
              <VehicleCard vehicle={vehicle} variant="manage" />
              {vehicle.status === 'pending_review' && (
                <button
                  onClick={() => setEditingVehicle(vehicle)}
                  className="absolute top-4 left-4 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg"
                >
                  Edit Media
                </button>
              )}
            </div>
          ))}
        </VehicleGrid>
      )}

      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          isOpen={!!editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSave={handleSaveMedia}
        />
      )}
    </div>
  );
}

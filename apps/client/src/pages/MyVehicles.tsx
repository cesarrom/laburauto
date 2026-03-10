import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings2, Sparkles } from 'lucide-react';
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

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Sincronizando flota</p>
          <p className="mt-2 text-2xl font-display text-text">Cargando tus vehículos…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Panel del publicador</p>
          <h1 className="text-3xl md:text-4xl font-display">Administrá documentación, fotos y disponibilidad.</h1>
          <p className="text-text-muted max-w-2xl">
            Actualizá media, cláusulas y auditorías sin salir de Laburauto. Cada auto refleja su estado de revisión y alertas clave.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/publish-vehicle"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-brand-600"
          >
            <Plus size={16} />
            Publicar vehículo
          </Link>
          <Link
            to="/applications"
            className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-text hover:border-brand-500"
          >
            <Settings2 size={16} />
            Ver postulaciones
          </Link>
        </div>
      </header>

      {myVehicles.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-border bg-surface px-8 py-12 text-center shadow-soft">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm uppercase tracking-[0.4em] text-text-muted">Aún sin flota</p>
          <p className="mt-4 text-text-muted">Publicá tu primer vehículo para habilitar contratos, auditorías y mensajería operativa.</p>
          <div className="mt-6">
            <Link
              to="/publish-vehicle"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Plus size={16} />
              Crear ficha
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
                  className="absolute top-4 left-4 z-10 rounded-full bg-brand-500/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lift hover:bg-brand-600"
                >
                  Actualizar media
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Check, Car, Eye } from 'lucide-react';
import VehicleReviewModal from '../../components/modals/VehicleReviewModal';

interface PendingVehicle {
  id: number;
  photos?: string[];
  vehicleModel?: {
    brandName?: string;
    modelName?: string;
  };
  plate?: string;
  year?: number;
  color?: string;
  publisher?: {
    name?: string;
  };
  createdAt: string;
}

export default function AdminVehicleReview() {
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<PendingVehicle | null>(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['admin-pending-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles?status=pending_review');
      return res.data as PendingVehicle[];
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/vehicles/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-vehicles'] });
      setSelectedVehicle(null);
      alert('Vehicle approved');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await api.put(`/vehicles/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-vehicles'] });
      setSelectedVehicle(null);
      alert('Vehicle rejected');
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Revisión en curso</p>
          <p className="mt-2 text-2xl font-display text-text">Cargando vehículos pendientes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-text">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft">
        <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Backoffice · Control de flota</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-display">Verificá documentación y liberá vehículos con un solo clic.</h1>
        <p className="text-text-muted mt-2 max-w-3xl">Cada solicitud incluye fotos, metadatos y publisher para acelerar tus revisiones.</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {vehicles?.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-[32px] bg-surface">
            <Check className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
            <p className="text-text-muted">No hay vehículos pendientes por aprobar.</p>
          </div>
        ) : (
          vehicles?.map((vehicle) => (
            <div key={vehicle.id} className="rounded-[32px] border border-border px-6 py-6 shadow-soft hover:shadow-lift transition-all flex flex-col md:flex-row gap-6">
              <div className="md:w-36 h-36 bg-surface-muted rounded-2xl overflow-hidden shrink-0">
                {vehicle.photos?.[0] ? (
                  <img src={vehicle.photos[0]} alt="vehicle" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted"><Car size={32} /></div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.4em] text-text-muted">#{vehicle.id}</span>
                  <span className="text-xs text-text-muted">Ingresó {new Date(vehicle.createdAt).toLocaleDateString('es-AR')}</span>
                </div>
                <h3 className="text-2xl font-display">
                  {vehicle.vehicleModel?.brandName} {vehicle.vehicleModel?.modelName}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                  <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.3em] text-text">{vehicle.plate || 'SIN PATENTE'}</span>
                  <span>{vehicle.year}</span>
                  <span>• {vehicle.color}</span>
                  <span>• Publicador: <strong>{vehicle.publisher?.name || 'Desconocido'}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicle(vehicle)}
                className="self-start md:self-center inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-brand-600"
              >
                <Eye size={16} /> Revisar ficha
              </button>
            </div>
          ))
        )}
      </div>

      <VehicleReviewModal
        vehicle={selectedVehicle}
        isOpen={!!selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
      />
    </div>
  );
}

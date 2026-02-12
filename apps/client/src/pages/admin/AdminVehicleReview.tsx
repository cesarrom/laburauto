import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Check, Car, Eye } from 'lucide-react';
import VehicleReviewModal from '../../components/modals/VehicleReviewModal';

export default function AdminVehicleReview() {
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['admin-pending-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles?status=pending_review');
      return res.data;
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

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading pending reviews...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Vehicle Approval Queue</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">
          Verify and approve platform listings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {vehicles?.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
            <Check className="w-16 h-16 text-emerald-200" />
            <p className="text-slate-400 font-black uppercase tracking-widest italic">All caught up! No pending reviews.</p>
          </div>
        ) : vehicles?.map((vehicle: any) => (
          <div key={vehicle.id} className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center gap-6 hover:shadow-lg transition-all">

            {/* Thumbnail */}
            <div className="w-32 h-32 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
              {vehicle.photos?.[0] ? (
                <img src={vehicle.photos[0]} alt="vehicle" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Car size={32} className="text-slate-200" /></div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-900">
                {vehicle.vehicleModel?.brandName} {vehicle.vehicleModel?.modelName}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {vehicle.plate}
                </span>
                <span className="text-xs font-bold text-slate-400">Year: {vehicle.year}</span>
                <span className="text-xs font-bold text-slate-400">• {vehicle.color}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span>Publisher: <strong>{vehicle.publisher?.name || 'Unknown'}</strong></span>
                <span>•</span>
                <span>Submitted: {new Date(vehicle.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={() => setSelectedVehicle(vehicle)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              <Eye size={16} /> Review
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
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

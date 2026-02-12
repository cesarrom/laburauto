import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { AlertCircle, Shield, User, Car } from 'lucide-react';
import EvidenceKitModal from '../../components/modals/EvidenceKitModal';

export default function AdminDisputes() {
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const res = await api.get('/bookings?disputeStatus=pending');
      return res.data;
    }
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading disputes...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Dispute Resolution</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">
            Mediate conflicts and review evidence
          </p>
        </div>
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-2xl text-red-600 border border-red-100">
          <AlertCircle size={20} />
          <span className="text-xs font-black uppercase tracking-widest">{disputes?.length || 0} Open Cases</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {disputes?.length === 0 ? (
          <div className="py-20 text-center bg-emerald-50 rounded-[3rem] border-4 border-dashed border-emerald-100 flex flex-col items-center gap-4">
            <Shield className="w-16 h-16 text-emerald-200" />
            <p className="text-slate-400 font-black uppercase tracking-widest italic">Peace prevails! No active disputes.</p>
          </div>
        ) : disputes?.map((booking: any) => (
          <div key={booking.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-red-100 flex flex-col gap-6 hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-red-50 rounded-3xl text-red-500">
                  <AlertCircle size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Case #D-{booking.id}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status: {booking.disputeStatus}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBookingId(booking.id)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-lg flex items-center gap-2"
              >
                <Shield size={16} /> Open Evidence Kit
              </button>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Dispute Notes:</p>
              <p className="text-sm text-slate-700 italic">"{booking.disputeNotes || 'No notes provided'}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl">
                <User className="text-slate-300" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Renter</p>
                  <p className="text-sm font-bold">{booking.driver?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl">
                <Car className="text-slate-300" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Vehicle</p>
                  <p className="text-sm font-bold">{booking.vehicle?.vehicleModel?.brandName} {booking.vehicle?.vehicleModel?.modelName}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all active:scale-95 shadow-lg">
                Resolve for Renter
              </button>
              <button className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all active:scale-95 shadow-lg">
                Resolve for Publisher
              </button>
              <button className="px-6 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedBookingId && (
        <EvidenceKitModal
          bookingId={selectedBookingId}
          isOpen={!!selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { AlertTriangle, Shield, User, Car } from 'lucide-react';
import EvidenceKitModal from '../../components/modals/EvidenceKitModal';

interface DisputeBooking {
  id: number;
  disputeStatus?: string;
  disputeNotes?: string;
  driver?: { name?: string };
  vehicle?: { vehicleModel?: { brandName?: string; modelName?: string } };
}

export default function AdminDisputes() {
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const res = await api.get('/bookings?disputeStatus=pending');
      return res.data as DisputeBooking[];
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Resolviendo disputas</p>
          <p className="mt-2 text-2xl font-display text-text">Cargando casos pendientes…</p>
        </div>
      </div>
    );
  }

  const totalCases = disputes?.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-text">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Backoffice · Mediación operativa</p>
          <h1 className="text-3xl md:text-4xl font-display">Revisá evidencia y resolvé disputas con contexto completo.</h1>
          <p className="text-text-muted max-w-3xl">Cada caso trae notas, datos del conductor y del vehículo para que puedas decidir en segundos.</p>
        </div>
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-red-400">Casos abiertos</p>
          <p className="text-2xl font-display text-red-400">{totalCases}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {totalCases === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-[32px] bg-surface flex flex-col items-center gap-4">
            <Shield className="w-16 h-16 text-emerald-300" />
            <p className="text-text-muted">Paz total: no hay disputas activas.</p>
          </div>
        ) : (
          disputes!.map((booking) => (
            <div key={booking.id} className="rounded-[32px] border border-border p-6 shadow-soft hover:shadow-lift transition flex flex-col gap-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-4 bg-red-500/10 rounded-3xl text-red-500">
                    <AlertTriangle size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display">Caso #{booking.id}</h3>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Estado: {booking.disputeStatus || 'Pendiente'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBookingId(booking.id)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-brand-600"
                >
                  <Shield size={16} /> Abrir kit probatorio
                </button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface-muted px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Notas registradas</p>
                <p className="mt-2 text-sm text-text">“{booking.disputeNotes || 'Sin notas aún'}”</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 rounded-2xl border border-border px-4 py-3">
                  <User className="text-text-muted" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">Conductor</p>
                    <p className="font-semibold">{booking.driver?.name || 'Desconocido'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-2xl border border-border px-4 py-3">
                  <Car className="text-text-muted" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">Vehículo</p>
                    <p className="font-semibold">
                      {booking.vehicle?.vehicleModel?.brandName} {booking.vehicle?.vehicleModel?.modelName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center sm:justify-end border-t border-border pt-4">
                <button className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                  Resolver a favor del conductor
                </button>
                <button className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-brand-500 text-white font-semibold hover:bg-brand-600">
                  Resolver a favor del publicador
                </button>
                <button className="flex-1 sm:flex-none px-4 py-2 rounded-2xl border border-border text-text hover:border-brand-500">
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <EvidenceKitModal
        bookingId={selectedBookingId ?? 0}
        isOpen={!!selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
      />
    </div>
  );
}

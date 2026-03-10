import { useAuth } from '../context/AuthContext';
import { useBookings } from '../hooks/useBookings';
import BookingItem from '../components/bookings/BookingItem';

export default function Bookings() {
  const { user } = useAuth();
  const { data: bookings, isLoading } = useBookings({ driverId: user?.id });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Sincronizando reservas</p>
          <p className="mt-2 text-2xl font-display text-text">Buscando contratos activos…</p>
        </div>
      </div>
    );
  }

  const totalBookings = bookings?.length ?? 0;
  const pendingActions = bookings?.filter((booking) => booking.status?.startsWith('pending')).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Reservas</p>
        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-display">Timeline completo de tus contratos.</h1>
            <p className="text-text-muted">
              Cada reserva muestra el estado documental, pagos y auditorías pendientes para que puedas reaccionar rápido.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="rounded-2xl border border-border px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Activas</p>
              <p className="text-2xl font-display text-brand-500">{totalBookings}</p>
            </div>
            <div className="rounded-2xl border border-border px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Pendientes</p>
              <p className="text-2xl font-display text-text">{pendingActions}</p>
            </div>
          </div>
        </div>
      </header>

      {totalBookings > 0 ? (
        <div className="space-y-6">
          {bookings!.map((booking) => (
            <BookingItem key={booking.id} booking={booking} />
          ))}
        </div>
      ) : (
        <div className="rounded-[32px] border border-dashed border-border bg-surface px-6 py-12 text-center shadow-soft">
          <p className="text-sm uppercase tracking-[0.4em] text-text-muted">Sin reservas</p>
          <p className="mt-4 text-text-muted">
            Todavía no iniciaste contratos. Publicá o reservá un vehículo para ver el timeline completo acá.
          </p>
        </div>
      )}
    </div>
  );
}

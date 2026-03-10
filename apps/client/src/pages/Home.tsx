import { useVehicles } from '../hooks/useVehicles';
import VehicleGrid from '../components/vehicles/VehicleGrid';
import VehicleCard from '../components/vehicles/VehicleCard';

export default function Home() {
  const { data: vehicles, isLoading } = useVehicles();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Actualizando flota</p>
          <p className="mt-2 text-2xl font-display text-text">Buscando vehículos disponibles…</p>
        </div>
      </div>
    );
  }

  const totalVehicles = vehicles?.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-10">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft">
        <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Panel de flota</p>
        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-display">
              Organizá tus alquileres activos en minutos.
            </h1>
            <p className="text-text-muted max-w-2xl">
              Gestioná disponibilidades, precios y documentación sin salir de Laburauto. Cada tarjeta refleja el estado documental y operativo de tus autos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Activos</p>
              <p className="text-2xl font-display text-brand-500">{totalVehicles}</p>
            </div>
            <div className="rounded-2xl border border-border px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Disponibles hoy</p>
              <p className="text-2xl font-display text-text">{totalVehicles > 8 ? '8+' : totalVehicles}</p>
            </div>
          </div>
        </div>
      </header>

      {totalVehicles === 0 ? (
        <div className="border border-dashed border-border rounded-[32px] p-12 text-center shadow-soft">
          <p className="text-sm uppercase tracking-[0.4em] text-text-muted">Sin vehículos listados</p>
          <p className="mt-4 text-text-muted">
            Agregá tu primer auto desde “Publicar vehículo” para habilitar contratos y auditorías.
          </p>
        </div>
      ) : (
        <VehicleGrid>
          {vehicles?.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} variant="browse" />
          ))}
        </VehicleGrid>
      )}
    </div>
  );
}

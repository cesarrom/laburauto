import { Link } from 'react-router-dom';
import { Car, MapPin, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import StatusBadge from '../ui/StatusBadge';

export interface VehicleCardProps {
  vehicle: {
    id: number;
    make: string;
    model: string;
    plate?: string;
    year?: number;
    imageUrl: string | null;
    status: string; // 'active' | 'pending_review' etc.
    shifts?: {
      id: number;
      type: string;
      price: number;
      startTime: string;
      endTime: string;
    }[];
  };
  variant?: 'browse' | 'manage';
}

export default function VehicleCard({ vehicle, variant = 'browse' }: VehicleCardProps) {
  const isBrowse = variant === 'browse';

  return (
    <div className="bg-surface rounded-[28px] border border-border shadow-soft overflow-hidden hover:shadow-lift transition-all group h-full flex flex-col">
      <Link to={`/vehicles/${vehicle.id}`} className="block relative aspect-video bg-surface-muted overflow-hidden">
        {vehicle.imageUrl ? (
          <img
            src={vehicle.imageUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Laburauto'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <Car className="h-12 w-12" />
          </div>
        )}

        <div className="absolute top-3 right-3 pointer-events-none">
          <StatusBadge status={vehicle.status} />
        </div>
      </Link>

      <div className="p-5 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-display leading-tight">
            <Link to={`/vehicles/${vehicle.id}`} className="hover:text-brand-500 transition-colors">
              {vehicle.make} {vehicle.model}
            </Link>
          </h3>
          <p className="text-sm text-text-muted">
            {vehicle.year && `(${vehicle.year}) `}
            {vehicle.plate || 'Sin patente visible'}
          </p>
        </div>

        {isBrowse && (
          <div className="flex items-center text-text-muted text-xs">
            <MapPin className="h-3.5 w-3.5 mr-1" />
            <span>Disponible cerca</span>
          </div>
        )}

        {vehicle.shifts && vehicle.shifts.length > 0 && (
          <div className="space-y-2 flex-1">
            {vehicle.shifts.slice(0, 2).map((shift) => (
              <div key={shift.id} className="flex justify-between items-center text-xs p-2 bg-surface-muted rounded-2xl border border-border/60">
                <div className="flex items-center text-text">
                  <Clock className="h-3 w-3 mr-1.5 text-brand-500" />
                  <span className="capitalize">{shift.type}</span>
                </div>
                <div className="font-semibold text-text">${shift.price}</div>
              </div>
            ))}
            {vehicle.shifts.length > 2 && (
              <p className="text-xs text-center text-text-muted">+{vehicle.shifts.length - 2} turnos más</p>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-border/60">
          <Link
            to={`/vehicles/${vehicle.id}`}
            className={clsx(
              'block w-full text-center py-2.5 rounded-2xl font-semibold text-sm transition-colors',
              isBrowse
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'border border-brand-500 text-brand-500 hover:bg-brand-500/10'
            )}
          >
            {isBrowse ? 'Ver disponibilidad' : 'Gestionar vehículo'}
          </Link>
        </div>
      </div>
    </div>
  );
}

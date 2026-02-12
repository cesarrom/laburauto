import { Link } from 'react-router-dom';
import { Car, MapPin, Clock } from 'lucide-react';
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group h-full flex flex-col">
      <Link to={`/vehicles/${vehicle.id}`} className="block relative aspect-video bg-gray-100 overflow-hidden">
        {vehicle.imageUrl ? (
          <img
            src={vehicle.imageUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=No+Image'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Car className="h-12 w-12" />
          </div>
        )}

        {/* Status Badge Over Image for Manage view, or generally useful */}
        <div className="absolute top-2 right-2 pointer-events-none">
          <StatusBadge status={vehicle.status} />
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              <Link to={`/vehicles/${vehicle.id}`} className="hover:text-blue-600 transition">
                {vehicle.make} {vehicle.model}
              </Link>
            </h3>
            <p className="text-sm text-gray-500">{vehicle.year ? `(${vehicle.year})` : ''} {vehicle.plate}</p>
          </div>
        </div>

        {isBrowse && (
          <div className="flex items-center text-gray-500 text-xs mb-4">
            <MapPin className="h-3.5 w-3.5 mr-1" />
            <span>Nearby</span>
          </div>
        )}

        {/* Shifts Preview */}
        {vehicle.shifts && vehicle.shifts.length > 0 && (
          <div className="space-y-2 mb-4 flex-1">
            {vehicle.shifts.slice(0, 2).map((shift) => (
              <div key={shift.id} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center text-gray-700">
                  <Clock className="h-3 w-3 mr-1.5 text-blue-500" />
                  <span className="capitalize">{shift.type}</span>
                </div>
                <div className="font-bold text-gray-900">
                  ${shift.price}
                </div>
              </div>
            ))}
            {vehicle.shifts.length > 2 && (
              <p className="text-xs text-center text-gray-400">+{vehicle.shifts.length - 2} more shifts</p>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-gray-100">
          <Link
            to={`/vehicles/${vehicle.id}`}
            className={`block w-full text-center py-2 rounded-lg font-semibold text-sm transition-colors ${isBrowse
                ? 'bg-black text-white hover:bg-gray-800'
                : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
              }`}
          >
            {isBrowse ? 'Rent Now' : 'Manage Vehicle'}
          </Link>
        </div>
      </div>
    </div>
  );
}

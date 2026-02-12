import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface FuzzyMapProps {
  lat: number;
  lng: number;
  radius: number; // meters
  className?: string;
}

export default function FuzzyMap({ lat, lng, radius, className = "h-64" }: FuzzyMapProps) {
  if (!lat || !lng) return <div className="bg-gray-100 flex items-center justify-center text-gray-400 h-full">Location not available</div>;

  return (
    <div className={`${className} bg-gray-100 rounded-lg overflow-hidden border border-gray-200 z-0`}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[lat, lng]}
          radius={radius}
          pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }}
        />
      </MapContainer>
    </div>
  );
}

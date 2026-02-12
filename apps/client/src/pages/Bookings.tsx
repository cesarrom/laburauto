import { useAuth } from '../context/AuthContext';
import { useBookings } from '../hooks/useBookings';
import BookingItem from '../components/bookings/BookingItem';

export default function Bookings() {
  const { user } = useAuth();
  const { data: bookings, isLoading } = useBookings({ driverId: user?.id });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading bookings...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

      {bookings && bookings.length > 0 ? (
        <div className="space-y-6">
          {bookings.map(booking => (
            <BookingItem key={booking.id} booking={booking} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">No bookings found.</p>
        </div>
      )}
    </div>
  );
}

import { clsx } from 'clsx';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  type?: 'vehicle' | 'booking';
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStyle = (status: string) => {
    switch (status) {
      // Vehicle Statuses
      case 'pending_review':
        return "bg-yellow-100 text-yellow-800";
      case 'active':
        return "bg-green-100 text-green-800";
      case 'rejected':
        return "bg-red-100 text-red-800";
      case 'maintenance':
        return "bg-orange-100 text-orange-800";
      case 'rented':
        return "bg-blue-100 text-blue-800";

      // Booking Statuses
      case 'pending_publisher_signature':
        return "bg-indigo-50 text-indigo-700 border border-indigo-200";
      case 'pending_renter_signature':
        return "bg-purple-50 text-purple-700 border border-purple-200";
      case 'pending_payment':
        return "bg-yellow-50 text-yellow-700 border border-yellow-200";
      case 'payment_sent':
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case 'confirmed':
        return "bg-teal-50 text-teal-700 border border-teal-200";
      case 'completed':
        return "bg-gray-100 text-gray-700 border border-gray-200";
      case 'cancelled':
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'pending_review':
      case 'pending_publisher_signature':
      case 'pending_renter_signature':
      case 'pending_payment':
        return <Clock size={14} />;
      case 'active':
      case 'confirmed':
        return <CheckCircle size={14} />;
      case 'rejected':
      case 'cancelled':
        return <XCircle size={14} />;
      case 'payment_sent':
        return <AlertCircle size={14} />;
      default:
        return null;
    }
  };

  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide",
      getStyle(status),
      className
    )}>
      {getIcon(status)}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

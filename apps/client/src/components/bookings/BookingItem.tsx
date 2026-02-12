import { useState } from 'react';
import { Clock, Key, CheckCircle, AlertCircle, FileText, Camera, Upload } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from '../ui/StatusBadge';
import { type BookingWithDetails, useStartRental, useResendInvitation } from '../../hooks/useBookings';
import PaymentProofModal from '../modals/PaymentProofModal';
import PhotoAuditModal from '../modals/PhotoAuditModal';


interface BookingItemProps {
  booking: BookingWithDetails;
}

export default function BookingItem({ booking }: BookingItemProps) {
  const startRental = useStartRental();
  const resendInvitation = useResendInvitation();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditType, setAuditType] = useState<'check_in' | 'check_out'>('check_in');



  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-all">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{booking.vehicle.vehicleModel.brandName} {booking.vehicle.vehicleModel.modelName}</h3>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{booking.vehicle.plate}</span>
        </div>
        <StatusBadge status={booking.status || 'pending_payment'} type="booking" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-sm text-gray-600 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900">
              {booking.startDate === booking.endDate
                ? format(new Date(booking.startDate), 'MMM d, yyyy')
                : `${format(new Date(booking.startDate), 'MMM d')} - ${format(new Date(booking.endDate), 'MMM d, yyyy')}`}
            </span>
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
              {(booking.selectedShiftIds as any[])?.length || 0} shift(s) selected
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end font-bold text-slate-900 text-lg">
          ${booking.totalPrice?.toLocaleString()}
        </div>
      </div>

      {/* ACTION FLOW */}
      <div className="pt-2">
        {/* WAITING FOR PUBLISHER SIGNATURE */}
        {booking.status === 'pending_publisher_signature' && (
          <div className="flex flex-col items-center py-6 text-slate-400 gap-3">
            <div className="p-4 bg-slate-50 rounded-full animate-pulse">
              <FileText size={32} />
            </div>
            <p className="text-sm font-black uppercase tracking-widest italic">Waiting for Publisher</p>
            <p className="text-xs text-center px-8">The publisher needs to sign the contract first. You'll be notified when it's your turn.</p>
          </div>
        )}

        {/* RENTER'S TURN TO SIGN */}
        {booking.status === 'pending_renter_signature' && (
          <div className="p-5 bg-indigo-50 border-2 border-indigo-100 rounded-3xl text-indigo-900 flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <FileText className="w-6 h-6 flex-shrink-0 text-indigo-500" />
              <div className="text-sm font-medium">
                <p className="font-black uppercase tracking-widest text-[10px] mb-1">Sign Agreement</p>
                <p>The publisher has signed! Please check your email to sign the rental agreement.</p>
              </div>
            </div>
            <button
              onClick={async () => {
                if (booking.contractId && confirm('Resend the signing invitation email to yourself?')) {
                  resendInvitation.mutate(booking.contractId);
                }
              }}
              disabled={resendInvitation.isPending}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 self-end font-bold disabled:opacity-50"
            >
              {resendInvitation.isPending ? 'Sending...' : 'Resend Link to Email'}
            </button>
          </div>
        )}

        {/* PAYMENT STEP */}
        {booking.status === 'pending_payment' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-5 bg-amber-50 border-2 border-amber-100 rounded-3xl text-amber-900">
              <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-500" />
              <div className="text-sm font-medium">
                <p className="font-black uppercase tracking-widest text-[10px] mb-1">Payment Required</p>
                <p>Contract signed! Now transfer <span className="font-bold">${booking.totalPrice?.toLocaleString()}</span> to the publisher and upload the receipt.</p>
              </div>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Upload Transfer Receipt
            </button>
          </div>
        )}

        {booking.status === 'payment_sent' && (
          <div className="flex flex-col items-center py-6 text-slate-400 gap-3">
            <div className="p-4 bg-slate-50 rounded-full animate-pulse">
              <Clock size={32} />
            </div>
            <p className="text-sm font-black uppercase tracking-widest italic">Waiting for Confirmation</p>
            <p className="text-xs text-center px-8">The publisher is verifying your transfer. You'll be notified once confirmed.</p>
          </div>
        )}

        {booking.status === 'confirmed' && (
          <div className="space-y-4">
            <div className="p-5 bg-emerald-50 border-2 border-emerald-100 rounded-3xl text-emerald-900 flex items-start gap-4">
              <CheckCircle className="w-6 h-6 flex-shrink-0 text-emerald-500" />
              <div className="text-sm font-medium">
                <p className="font-black uppercase tracking-widest text-[10px] mb-1">Booking Confirmed</p>
                <p>You're all set! Now you need to sign the contract and perform the check-in audit.</p>
              </div>
            </div>

            <div className="p-5 bg-indigo-50 border-2 border-indigo-100 rounded-3xl text-indigo-900 flex flex-col gap-3">
              <div className="flex items-start gap-4">
                <FileText className="w-6 h-6 flex-shrink-0 text-indigo-500" />
                <div className="text-sm font-medium">
                  <p className="font-black uppercase tracking-widest text-[10px] mb-1">Sign Agreement</p>
                  <p>Check your email to review and sign the contract securely. This is required for identity verification.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (booking.contractId && confirm('Resend the signing invitation email to yourself?')) {
                    resendInvitation.mutate(booking.contractId);
                  }
                }}
                disabled={resendInvitation.isPending}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 self-end font-bold disabled:opacity-50"
              >
                {resendInvitation.isPending ? 'Sending...' : 'Resend Link to Email'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { setAuditType('check_in'); setShowAuditModal(true); }}
                className="py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg sm:col-span-2"
              >
                <Camera size={16} />
                Check-in Audit
              </button>
            </div>

            {booking.contractFullySigned ? (
              <button
                onClick={() => startRental.mutate(booking.id)}
                disabled={startRental.isPending}
                className="w-full py-4 border-2 border-slate-900 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Key className="w-5 h-5" />
                {startRental.isPending ? 'Accessing...' : 'Access Car'}
              </button>
            ) : (
              <div className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-not-allowed">
                <FileText className="w-5 h-5" />
                Waiting for Signatures
              </div>
            )}
          </div>
        )
        }

        {
          booking.status === 'active' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-emerald-600 bg-emerald-50 p-5 rounded-3xl border-2 border-emerald-100">
                <div className="p-2 bg-emerald-500 rounded-full text-white">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">Rental Active</p>
                  <p className="text-sm font-bold">You have full access to the vehicle.</p>
                </div>
              </div>
              <button
                onClick={() => { setAuditType('check_out'); setShowAuditModal(true); }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Camera size={18} />
                Perform Check-out & End
              </button>
            </div>
          )
        }

        {
          booking.status === 'completed' && (
            <div className="flex items-center justify-center gap-3 text-slate-400 py-4 font-black uppercase tracking-widest text-xs italic">
              <CheckCircle size={16} />
              Rental Completed
            </div>
          )
        }
      </div >

      {/* Modals */}
      < PaymentProofModal
        bookingId={booking.id}
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => { }} // Status updated by modal
      />

      < PhotoAuditModal
        bookingId={booking.id}
        type={auditType}
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        onSuccess={() => {
          if (auditType === 'check_out') {
            // No need to manually update status, backend does it
          }
          alert(`${auditType === 'check_in' ? 'Check-in' : 'Check-out'} completed successfully!`);
        }}
      />

    </div >
  );
}

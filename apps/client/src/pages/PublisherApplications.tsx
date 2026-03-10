import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePublisherApplications, useApproveApplication, useRejectApplication, useApplication } from '../hooks/useApi';
import { useConfirmPayment, useResendInvitation } from '../hooks/useBookings';
import { format } from 'date-fns';
import { Calendar, Clock, DollarSign, CheckCircle, User, Shield, FileText, Send } from 'lucide-react';
import ApplicationDetailDialog from '../components/ApplicationDetailDialog';
import EvidenceKitModal from '../components/modals/EvidenceKitModal';

type BookingStatus =
  | 'pending_publisher_signature'
  | 'pending_renter_signature'
  | 'pending_payment'
  | 'payment_sent'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface BookingSummary {
  id: number;
  status: BookingStatus;
  contractId?: number;
}

interface ApplicationSummary {
  id: number;
  status: string;
  createdAt: string;
  totalPrice: number;
  selectedDates: string[];
  vehicle?: {
    vehicleModel?: {
      brandName?: string;
      modelName?: string;
    };
  };
  renter?: {
    name?: string;
    email?: string;
  };
  booking?: BookingSummary;
}

export default function PublisherApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [selectedEvidenceBookingId, setSelectedEvidenceBookingId] = useState<number | null>(null);
  const { data: applications, isLoading } = usePublisherApplications(user?.id);
  const { data: selectedApp } = useApplication(selectedAppId ?? undefined);
  const approveMutation = useApproveApplication();
  const rejectMutation = useRejectApplication();
  const confirmPaymentMutation = useConfirmPayment();
  const resendInvitationMutation = useResendInvitation();

  const handleApprove = async (appId: number) => {
    if (!confirm('Approve this application? The renter will be notified and given a payment deadline.')) return;

    try {
      await approveMutation.mutateAsync(appId);
      alert('Application approved! Renter has been notified.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve');
    }
  };

  const handleConfirmPayment = async (bookingId: number) => {
    if (!confirm('Confirm you received the payment? This will grant the renter access to the vehicle.')) return;
    try {
      await confirmPaymentMutation.mutateAsync(bookingId);
      alert('Payment confirmed! Renter can now access the car.');
    } catch (error) {
      alert('Failed to confirm payment receipt');
    }
  };

  const handleReject = async (appId: number) => {
    if (!confirm('Reject this application? The renter will be notified.')) return;

    try {
      await rejectMutation.mutateAsync(appId);
      alert('Application rejected.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-xl">Loading...</div></div>;
  }

  // Unified status logic
  const getUnifiedStatus = (app: ApplicationSummary) => {
    if (app.status === 'pending') return { label: 'Pending Review', color: 'orange', action: 'review' };
    if (app.status === 'rejected') return { label: 'Rejected', color: 'red', action: 'none' };

    // If approved, check booking
    if (!app.booking) return { label: 'Approved (Pending Booking)', color: 'blue', action: 'wait' };

    const bStatus = app.booking.status;

    // Explicit status mapping
    if (bStatus === 'pending_publisher_signature') return { label: 'Sign Contract', color: 'yellow', action: 'sign_contract' };
    if (bStatus === 'pending_renter_signature') return { label: 'Waiting for Renter Signature', color: 'blue', action: 'wait' };
    if (bStatus === 'pending_payment') return { label: 'Waiting for Payment', color: 'blue', action: 'wait' };
    if (bStatus === 'payment_sent') return { label: 'Payment Sent', color: 'yellow', action: 'confirm_payment' };
    if (bStatus === 'confirmed') return { label: 'Confirmed', color: 'green', action: 'view' };
    if (bStatus === 'active') return { label: 'Active', color: 'green', action: 'view' };
    if (bStatus === 'completed') return { label: 'Completed', color: 'gray', action: 'view' };
    if (bStatus === 'cancelled') return { label: 'Cancelled', color: 'gray', action: 'none' };
    if (bStatus === 'expired') return { label: 'Expired', color: 'red', action: 'none' };

    return { label: app.status, color: 'gray', action: 'none' };
  };

  // Sort applications: Action Required First, then Date
  const sortedApps = useMemo(() => {
    return [...(applications || [])].sort((a, b) => {
      const statusA = getUnifiedStatus(a);
      const statusB = getUnifiedStatus(b);

      const getScore = (status: ReturnType<typeof getUnifiedStatus>) => {
        if (status.action === 'confirm_payment') return 3;
        if (status.action === 'review') return 2;
        if (status.action === 'wait') return 1;
        return 0;
      };

      const scoreA = getScore(statusA);
      const scoreB = getScore(statusB);

      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [applications]);

  const pendingReviews = applications?.filter((app) => getUnifiedStatus(app).action === 'review').length ?? 0;
  const awaitingPayments = applications?.filter((app) => getUnifiedStatus(app).action === 'confirm_payment').length ?? 0;
  const activeBookings = applications?.filter((app) => getUnifiedStatus(app).label === 'Active').length ?? 0;
    const statusA = getUnifiedStatus(a);
    const statusB = getUnifiedStatus(b);

    // Priority: 'confirm_payment' > 'review' > others
    const getScore = (status: any) => {
      if (status.action === 'confirm_payment') return 3;
      if (status.action === 'review') return 2;
      if (status.action === 'wait') return 1;
      return 0;
    };

    const scoreA = getScore(statusA);
    const scoreB = getScore(statusB);

    if (scoreA !== scoreB) return scoreB - scoreA;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Sincronizando aplicaciones</p>
          <p className="mt-2 text-2xl font-display text-text">Cargando solicitudes y contratos…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-text">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft space-y-5">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Laburauto · Flujo de postulaciones</p>
          <h1 className="text-3xl md:text-4xl font-display">Aprobá, coordiná pagos y liberá autos desde un solo panel.</h1>
          <p className="text-text-muted max-w-3xl">
            Ordenamos las solicitudes según la acción pendiente: revisión, firma o confirmación de pago.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Revisar</p>
            <p className="text-2xl font-display text-text">{pendingReviews}</p>
          </div>
          <div className="rounded-2xl border border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Confirmar pagos</p>
            <p className="text-2xl font-display text-brand-500">{awaitingPayments}</p>
          </div>
          <div className="rounded-2xl border border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.4em] text-text-muted">Activos</p>
            <p className="text-2xl font-display text-emerald-500">{activeBookings}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {sortedApps.map((app) => {
          const unified = getUnifiedStatus(app);
          const dates = app.selectedDates as string[];
          const bookingId = app.booking?.id;

          const theme = {
            orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-800' },
            red: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-900', badge: 'bg-red-100 text-red-800' },
            blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' },
            yellow: { border: 'border-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-900', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
            green: { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-900', badge: 'bg-green-100 text-green-800' },
            gray: { border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-900', badge: 'bg-gray-100 text-gray-800' },
          }[unified.color] || { border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-900', badge: 'bg-gray-100' };

          return (
            <div key={app.id} className={`rounded-[32px] border px-6 py-6 shadow-soft hover:shadow-lift transition-all ${theme.border}`}>
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${theme.badge}`}>
                      {unified.label}
                    </span>
                    <span className="text-xs text-gray-400">ID: #{app.id}</span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900">
                    {app.vehicle?.vehicleModel?.brandName} {app.vehicle?.vehicleModel?.modelName}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <User className="h-4 w-4" />
                    <span className="font-semibold">{app.renter?.name}</span>
                    <span className="text-gray-400">•</span>
                    <span>{app.renter?.email}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-gray-900">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                    <span className="text-2xl font-bold">${app.totalPrice?.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</p>
                </div>
              </div>

              <div className={`rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-center ${theme.bg}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Rental Period</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-6">
                    {format(new Date(dates[0]), 'MMM d')} - {format(new Date(dates[dates.length - 1]), 'MMM d, yyyy')}
                    <span className="text-gray-400 ml-2">({dates.length} days)</span>
                  </p>
                </div>

                {/* Action Area */}
                <div className="flex items-center justify-end gap-3">
                  {unified.action === 'review' && (
                    <>
                      <button
                        onClick={() => setSelectedAppId(app.id)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                      >
                        Review Details
                      </button>
                      <button
                        onClick={() => handleApprove(app.id)}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition shadow-sm"
                      >
                        Approve Request
                      </button>
                    </>
                  )}

                  {unified.action === 'confirm_payment' && (
                    <button
                      onClick={() => handleConfirmPayment(bookingId)}
                      className="w-full md:w-auto px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 shadow-lift flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Confirm Payment Received
                    </button>
                  )}

                  {unified.action === 'wait' && (
                    <div className="text-sm text-brand-500 flex items-center gap-2 font-medium">
                      <Clock size={16} />
                      <span>Waiting for renter action...</span>
                    </div>
                  )}

                  {unified.action === 'sign_contract' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => navigate(`/portal/contracts/${app.booking?.contractId}`)}
                        className="w-full md:w-auto px-5 py-2.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 shadow-lift flex items-center gap-2"
                      >
                        <FileText size={18} />
                        Sign Rental Agreement
                      </button>
                      <button
                        onClick={() => {
                          if (bookingId && confirm('¿Reenviar invitación de firma?')) {
                            resendInvitationMutation.mutate(bookingId);
                          }
                        }}
                        className="text-xs text-brand-500 hover:text-brand-600 underline flex items-center justify-end gap-1"
                        disabled={resendInvitationMutation.isPending}
                      >
                        <Send size={12} /> {resendInvitationMutation.isPending ? 'Enviando…' : 'Reenviar correo'}
                      </button>
                    </div>
                  )}

                  {unified.action !== 'confirm_payment' && unified.action !== 'review' && unified.action !== 'sign_contract' && (
                    <div className="flex items-center gap-3">
                      {user?.role === 'admin' && bookingId && (
                        <button
                          onClick={() => setSelectedEvidenceBookingId(bookingId)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-500 px-3 py-1.5 bg-brand-500/10 rounded-full hover:bg-brand-500/15"
                        >
                          <Shield size={12} /> Evidence
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedAppId(app.id)}
                        className="text-sm text-text-muted hover:text-text underline underline-offset-2 decoration-border"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {selectedEvidenceBookingId && (
          <EvidenceKitModal
            bookingId={selectedEvidenceBookingId}
            isOpen={!!selectedEvidenceBookingId}
            onClose={() => setSelectedEvidenceBookingId(null)}
          />
        )}

        {sortedApps.length === 0 && (
          <div className="text-center py-20 border border-dashed border-border rounded-[32px] bg-surface">
            <Clock className="h-12 w-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text">Aún no hay postulaciones</h3>
            <p className="text-text-muted">Las solicitudes nuevas aparecerán acá automáticamente.</p>
          </div>
        )}
      </div>

      {selectedApp && (
        <ApplicationDetailDialog
          application={selectedApp}
          isOpen={!!selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onApprove={() => {
            handleApprove(selectedApp.id);
            setSelectedAppId(null);
          }}
          onReject={() => {
            handleReject(selectedApp.id);
            setSelectedAppId(null);
          }}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
        />
      )}
    </div>
  );
}

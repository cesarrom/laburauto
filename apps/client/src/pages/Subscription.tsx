import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import api from '../lib/api';
import { CreditCard, ExternalLink, History, CheckCircle2, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';

interface Execution {
  id: string | number;
  created_at: string;
  amount_paid: number;
  currency: string;
  status: string;
  order_id: string;
  external_transaction_id?: string;
}

export default function Subscription() {
  const { user } = useAuth();
  const { openSubscription } = useUI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    status: string;
    subscriptionId: string | null;
    executions: Execution[];
  } | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputePaymentId, setDisputePaymentId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const CONFIRM_PHRASE = 'CANCEL SUBSCRIPTION AND DELETE ALL VEHICLES';

  const fetchSubscriptionInfo = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/payments/subscriptions/me?userId=${user.id}`);
      setSubscriptionInfo(res.data);
    } catch (err) {
      console.error('Error fetching subscription info:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const verify = () => {
      api.post('/payments/verify', { userId: user.id })
        .catch(err => console.error('Auto-verify failed', err))
        .finally(() => { void fetchSubscriptionInfo(); });
    };

    verify();
    window.addEventListener('focus', verify);
    return () => window.removeEventListener('focus', verify);
  }, [user?.id, fetchSubscriptionInfo]);

  const handleSubscribe = async () => {
    try {
      await openSubscription({ autoStart: true });
      fetchSubscriptionInfo();
    } catch (err: unknown) {
      console.error('Subscription error', err);
      setError('No pudimos iniciar la suscripción. Intentá nuevamente.');
    }
  };

  const handleCancel = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setLoading(true);
    try {
      if (disputePaymentId) {
        // Handle Refund + Cancel
        await api.post(`/payments/${disputePaymentId}/dispute`, { userId: user?.id });
        alert('Action successful: Refund requested and subscription cancelled.');
      } else {
        // Handle Regular Cancel
        await api.post('/payments/subscriptions/cancel', {
          userId: user?.id,
          confirmation: confirmText
        });
        alert('Subscription cancelled and data cleaned up successfully.');
      }
      setCancelOpen(false);
      setDisputePaymentId(null);
      setConfirmText('');
      fetchSubscriptionInfo();
    } catch {
      alert(`No pudimos procesar la ${disputePaymentId ? 'reversión' : 'cancelación'}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async (paymentId: string) => {
    setDisputePaymentId(paymentId);
    setCancelOpen(true);
  };

  const isWithin10Days = (dateStr: string) => {
    const created = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 10;
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-text">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Laburauto · Suscripción operativa</p>
          <h1 className="text-3xl md:text-4xl font-display flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
              <CreditCard className="h-5 w-5" />
            </span>
            Gestioná tu plan Publisher Pro
          </h1>
          <p className="text-text-muted max-w-2xl">
            Mantener la suscripción activa garantiza soporte prioritario, auditorías automáticas y conservación del historial probatorio.
          </p>
        </div>
        {subscriptionInfo?.status === 'active' && (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Plan activo
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Plan actual</p>
                <h2 className="text-2xl font-display mt-2">Publisher Pro</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-muted">USD</p>
                <p className="text-3xl font-display text-brand-500">15</p>
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">por mes</p>
              </div>
            </div>

            {subscriptionInfo?.status !== 'active' ? (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-600 disabled:opacity-60"
              >
                <div className="flex items-center justify-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Activar suscripción
                </div>
              </button>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <History className="h-4 w-4 text-brand-500" /> Facturación mensual automática
                </div>
                <button
                  onClick={() => setCancelOpen(true)}
                  className="w-full rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-red-500 hover:border-red-400"
                >
                  Cancelar suscripción
                </button>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>

          <div className="rounded-[28px] border border-amber-400/40 bg-amber-50 p-6 text-amber-900 shadow-soft">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="h-5 w-5" /> Advertencia de cancelación
            </h3>
            <p className="mt-3 text-sm leading-relaxed">
              Al cancelar, eliminaremos vehículos publicados, detendremos contratos activos y notificaremos a conductores. Este paso es irreversible.
            </p>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-[32px] border border-border bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Historial de cobros</p>
              <h2 className="text-xl font-display flex items-center gap-2">
                <History className="h-5 w-5 text-brand-500" /> Pagos recientes
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            {subscriptionInfo?.executions && subscriptionInfo.executions.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.3em] text-text-muted">
                  <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Monto</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscriptionInfo.executions.map((exec, index) => (
                    <tr key={exec.id} className="hover:bg-surface-muted/60">
                      <td className="px-6 py-4">
                        <p className="font-medium">{new Date(exec.created_at).toLocaleDateString('es-AR')}</p>
                        <p className="text-xs text-text-muted font-mono">#{exec.order_id}</p>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {exec.currency} {exec.amount_paid.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${['COMPLETED', 'PAID'].includes(exec.status)
                          ? 'bg-emerald-400/15 text-emerald-400'
                          : exec.status === 'REFUNDED'
                            ? 'bg-sky-400/15 text-sky-400'
                            : exec.status === 'IN DISPUTE'
                              ? 'bg-amber-400/15 text-amber-500'
                              : exec.status === 'PENDING'
                                ? 'bg-orange-400/15 text-orange-500'
                                : 'bg-border text-text-muted'
                        }`}>
                          {exec.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {index === 0 && ['COMPLETED', 'PAID'].includes(exec.status) && isWithin10Days(exec.created_at) && (
                          <button
                            onClick={() => handleDispute(exec.id.toString())}
                            className="text-xs font-semibold text-red-500 hover:text-red-400"
                          >
                            Reintegro y baja total
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-14 text-center text-text-muted">
                <Clock className="mx-auto mb-3 h-10 w-10 opacity-40" />
                Sin movimientos registrados todavía.
              </div>
            )}
          </div>
        </section>
      </div>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-surface shadow-glow">
            <div className="flex items-center gap-3 border-b border-border px-6 py-4 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-lg font-display">{disputePaymentId ? 'Confirmar reintegro + cancelación' : 'Confirmar cancelación'}</h3>
            </div>
            <div className="space-y-4 px-6 py-6 text-sm">
              <p>
                {disputePaymentId
                  ? `Reintegraremos la transacción #${disputePaymentId} y permanentemente:`
                  : 'Cancelarás tu suscripción y permanentemente:'}
              </p>
              <ul className="list-disc space-y-2 pl-5 text-text-muted">
                <li>Eliminaremos tus vehículos publicados.</li>
                <li>Se cancelarán reservas confirmadas o activas.</li>
                <li>Notificaremos a los conductores afectados.</li>
              </ul>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Escribí la frase para continuar</label>
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-500">
                  {CONFIRM_PHRASE}
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Ingresá la frase exacta"
                  className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 focus:border-red-400"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setCancelOpen(false);
                    setDisputePaymentId(null);
                    setConfirmText('');
                  }}
                  className="flex-1 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-text hover:border-brand-500"
                >
                  Volver
                </button>
                <button
                  onClick={handleCancel}
                  disabled={confirmText !== CONFIRM_PHRASE || loading}
                  className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lift transition disabled:opacity-40"
                >
                  {loading ? 'Procesando…' : disputePaymentId ? 'Reintegrar y cancelar' : 'Cancelar plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

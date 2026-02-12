import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (user?.id) {
      const verify = () => {
        api.post('/payments/verify', { userId: user.id })
          .catch(err => console.error('Auto-verify failed', err))
          .finally(() => fetchSubscriptionInfo());
      };

      // Auto-verify on mount
      verify();

      // Auto-verify when user returns to tab
      window.addEventListener('focus', verify);
      return () => window.removeEventListener('focus', verify);
    }
  }, [user]);

  const fetchSubscriptionInfo = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/payments/subscriptions/me?userId=${user?.id}`);
      setSubscriptionInfo(res.data);
    } catch (err) {
      console.error('Error fetching subscription info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      await openSubscription({ autoStart: true });
      // On success (resolveSubscription in the modal), refresh local data
      fetchSubscriptionInfo();
    } catch (err: any) {
      console.error('Subscription error', err);
      setError('Failed to initiate subscription. Please try again.');
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
    } catch (err) {
      alert(`Failed to process ${disputePaymentId ? 'dispute' : 'cancellation'}.`);
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
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
          <div className="bg-blue-600 p-2 rounded-xl">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          Subscription
        </h1>
        {subscriptionInfo?.status === 'active' && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-bold border border-green-200">
            <CheckCircle2 size={16} /> Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Col: Status & Plan */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Current Plan</h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Publisher Pro</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-blue-600">$15.00</span>
                  <span className="text-gray-400 font-medium">/mo</span>
                </div>
              </div>

              {subscriptionInfo?.status !== 'active' ? (
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <ExternalLink size={20} /> Subscribe Now
                </button>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600 px-1">
                    <History size={16} className="text-blue-500" />
                    <span>Next billing date: Monthly</span>
                  </div>
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="w-full text-red-600 bg-red-50 py-3 rounded-xl font-bold hover:bg-red-100 transition border border-red-100"
                  >
                    Cancel Subscription
                  </button>
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-sm mt-3 font-medium">{error}</p>}
          </div>

          <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
            <h3 className="text-orange-900 font-bold flex items-center gap-2 mb-2">
              <ShieldAlert size={18} /> Cancellation Warning
            </h3>
            <p className="text-orange-800 text-sm leading-relaxed">
              Cancelling your subscription will immediately <strong>delete all your vehicles</strong> and cancel all active bookings. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Right Col: Billing History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <History className="text-blue-500" /> Billing History
              </h2>
            </div>

            <div className="overflow-x-auto">
              {subscriptionInfo?.executions && subscriptionInfo.executions.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subscriptionInfo.executions.map((exec, index) => (
                      <tr key={exec.id} className="hover:bg-gray-50/50 transition duration-200">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {new Date(exec.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">#{exec.order_id}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-700">
                          {exec.currency} {exec.amount_paid.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${['COMPLETED', 'PAID'].includes(exec.status) ? 'bg-green-100 text-green-700' :
                            exec.status === 'REFUNDED' ? 'bg-blue-100 text-blue-700' :
                              exec.status === 'IN DISPUTE' ? 'bg-yellow-100 text-yellow-700' :
                                exec.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                                  'bg-gray-100 text-gray-600'
                            }`}>
                            {exec.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {index === 0 && ['COMPLETED', 'PAID'].includes(exec.status) && isWithin10Days(exec.created_at) && (
                            <button
                              onClick={() => handleDispute(exec.id.toString())}
                              className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                            >
                              Refund & Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-12 text-center text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No billing records found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3 text-white">
              <AlertTriangle />
              <h2 className="font-bold text-xl">{disputePaymentId ? 'Confirm Refund & Cancellation' : 'Confirm Cancellation'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                {disputePaymentId
                  ? `This will refund transaction #${disputePaymentId} and permanently:`
                  : 'This will cancel your dLocal Go subscription and permanently:'
                }
              </p>
              <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
                <li>Delete all your published vehicles</li>
                <li>Cancel all confirmed and active bookings</li>
                <li>Notify all affected drivers</li>
              </ul>

              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Type the following to confirm:
                </label>
                <div className="bg-red-50 text-red-700 text-xs font-bold p-2 rounded border border-red-100 mb-3 select-none">
                  {CONFIRM_PHRASE}
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type the confirmation phrase here"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-red-500 outline-none transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setCancelOpen(false);
                    setDisputePaymentId(null);
                    setConfirmText('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
                >
                  Go Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={confirmText !== CONFIRM_PHRASE || loading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {loading ? 'Processing...' : (disputePaymentId ? 'Refund & Cancel Auto' : 'Cancel Auto')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

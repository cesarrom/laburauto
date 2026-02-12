import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { X, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useState, useEffect } from 'react';

export default function SubscriptionModal() {
  const { isSubscriptionOpen, subscriptionOptions, closeSubscription, resolveSubscription } = useUI();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (isSubscriptionOpen && subscriptionOptions.autoStart && !hasTriggered) {
      handleSubscribe();
      setHasTriggered(true);
    }

    // Background verify when modal opens or window regains focus
    if (isSubscriptionOpen && user?.id) {
      const verify = () => {
        api.post('/payments/verify', { userId: user.id })
          .then(res => {
            if (res.data.status === 'active') {
              resolveSubscription();
            }
          })
          .catch(err => console.error('Background verify failed', err));
      };

      verify();
      window.addEventListener('focus', verify);
      return () => window.removeEventListener('focus', verify);
    }

    if (!isSubscriptionOpen) {
      setHasTriggered(false);
    }
  }, [isSubscriptionOpen, subscriptionOptions.autoStart, user?.id]);

  if (!isSubscriptionOpen) return null;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // 1. Get the checkout URL from backend
      const res = await api.post('/payments/subscribe', { userId: user?.id });
      const { url } = res.data;

      // 2. Open dLocal checkout in new tab/window
      // In a real flow, we might redirect or use an iframe.
      // For dLocal Go, it's usually a hosted checkout page.
      window.open(url, '_blank');

      // 3. User subscribes in the new tab...
      // 4. We need to know when they are done. 
      // Option A: Polling
      // Option B: "I have paid" button
      // Option C: WebSocket/SSE

      // For this implementation, we will show a "I have completed payment" button
      // which triggers a check or simply resolves (optimistically or with a verify call).

    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to start subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await api.post('/payments/verify', { userId: user?.id });

      if (res.data.status === 'active') {
        resolveSubscription();
      } else {
        alert('Payment not verified yet. Please wait a moment and try again.');
      }
    } catch (error) {
      console.error('Verification error', error);
      alert('Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <CreditCard size={20} />
            <h2 className="font-semibold text-lg">Subscription Required</h2>
          </div>
          <button onClick={closeSubscription} className="text-white/80 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Unlock Publishing</h3>
            <p className="text-gray-600 mt-2">
              To publish vehicles on Laburauto, you need an active subscription.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-gray-900">Monthly Plan</span>
              <span className="text-blue-600 font-bold text-lg">$20.000 / mo</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">✓ Unlimited vehicle listings</li>
              <li className="flex items-center gap-2">✓ Priority support</li>
              <li className="flex items-center gap-2">✓ Verified badge</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <>Subscribe with dLocal <ExternalLink size={18} /></>}
            </button>

            <button
              onClick={handleVerify}
              className="w-full bg-white text-gray-700 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              I have completed payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

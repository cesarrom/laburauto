import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { TrendingUp, TrendingDown, Save, Loader2, AlertCircle } from 'lucide-react';

interface ReputationToolProps {
  userId: number;
  currentScore: number;
  onSuccess?: () => void;
}

export default function ReputationTool({ userId, currentScore, onSuccess }: ReputationToolProps) {
  const queryClient = useQueryClient();
  const [adjustment, setAdjustment] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/users/${userId}/reputation`, {
        adjustment,
        reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-evidence-kit'] });
      setAdjustment(0);
      setReason('');
      if (onSuccess) onSuccess();
      alert('Reputation adjusted successfully');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update reputation');
    }
  });

  const handleApply = async () => {
    if (!reason) {
      setError('A reason is required for manual adjustments');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Adjust Reputation</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manual Meritocracy Intervention</p>
        </div>
        <div className="px-5 py-2 bg-slate-900 text-white rounded-2xl font-black text-xs">
          CURRENT: {currentScore}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAdjustment(prev => prev - 5)}
            className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
          >
            <TrendingDown size={20} />
          </button>

          <div className="flex-1 text-center font-black text-3xl tracking-tighter text-slate-900 border-x-2 border-slate-50">
            {adjustment > 0 ? '+' : ''}{adjustment}
          </div>

          <button
            onClick={() => setAdjustment(prev => prev + 5)}
            className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
          >
            <TrendingUp size={20} />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Reasoning & Audit Trail</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you adjusting this score? (e.g. Excellent cleanliness, Late return...)"
            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm italic focus:border-indigo-400 focus:ring-0 transition-all font-medium"
            rows={3}
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-xs font-bold">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          disabled={mutation.isPending || adjustment === 0}
          onClick={handleApply}
          className={`
            w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95
            ${mutation.isPending || adjustment === 0
              ? 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-black'}
          `}
        >
          {mutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Applying Changes...
            </>
          ) : (
            <>
              <Save size={16} />
              Confirm Adjustment
            </>
          )}
        </button>
      </div>
    </div>
  );
}

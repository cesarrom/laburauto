import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentSigner } from '../components/DocumentSigner';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { FileText, Loader2 } from 'lucide-react';

const ContractSignerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [signerData, setSignerData] = useState<any>(null);
  const [contractInstance, setContractInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContract = async () => {
      try {
        const normalizeStageRole = (role?: string) => {
          if (!role) return '';
          if (role === 'renter') return 'driver';
          return role;
        };

        const res = await api.get(`/contracts/instances/${id}`);
        const instance = res.data;
        setContractInstance(instance);

        if (instance.docusealSignUrl) {
          window.location.assign(instance.docusealSignUrl);
          setLoading(false);
          return;
        }

        // Check if already signed
        if (instance.status === 'signed') {
          setError('This contract has already been fully signed.');
          setLoading(false);
          return;
        }

        // Determine active stage dynamically
        // Stage 1 = System (auto-completed)
        // Stage 2 = Publisher
        // Stage 3 = Renter (for rental agreements)
        // Determine active stage dynamically:
        // Stage 1 (System) is already auto-completed.
        // Stage 2 (First human signer) -> corresponds to humanStages[0]
        // Stage 3 (Second human signer) -> corresponds to humanStages[1]

        const signerStages = (instance.template.stages || []).filter((s: any) => s.action === 'sign' || s.type === 'signer');
        let activeStageId: string | null = null;
        let authWaitingFor = '';

        if (!instance.stage2CompletedAt) {
          // Stage 2 (First human signer)
          const stage = signerStages[0];
          if (stage) {
            const effectiveRole = normalizeStageRole(stage.role) || 'publisher'; // Fallback to publisher for first stage
            if (user?.role === effectiveRole) {
              activeStageId = stage.id;
            } else {
              authWaitingFor = effectiveRole;
            }
          }
        } else if (!instance.stage3CompletedAt) {
          // Stage 3 (Second human signer)
          const stage = signerStages[1];
          if (stage) {
            const effectiveRole = normalizeStageRole(stage.role) || (instance.template.type === 'rental_agreement' ? 'driver' : 'publisher');
            if (user?.role === effectiveRole) {
              activeStageId = stage.id;
            } else {
              authWaitingFor = effectiveRole;
            }
          }
        }

        if (!activeStageId) {
          if (authWaitingFor && authWaitingFor !== user?.role) {
            setError(`This stage of the contract requires a ${authWaitingFor} signature. You are logged in as a ${user?.role}.`);
          } else {
            setError('You do not have a pending signature for this contract.');
          }
          setLoading(false);
          return;
        }

        // Fetch PDF bytes - prefer finalPdfUrl (instance with variables) over template.pdfUrl
        const pdfUrl = instance.finalPdfUrl || instance.template.pdfUrl;
        const pdfRes = await api.get(pdfUrl, { responseType: 'arraybuffer' });

        setSignerData({
          id: instance.id,
          pdfFile: pdfRes.data,
          fields: instance.template.fields,
          stages: instance.template.stages,
          activeStageId
        });
      } catch (err: any) {
        console.error('Failed to load contract:', err);
        setError('Failed to load the contract. It may have been voided or you may not have permission to view it.');
      } finally {
        setLoading(false);
      }
    };

    if (id && user) {
      loadContract();
    } else if (!user) {
      setError('You must be logged in to sign this contract.');
      setLoading(false);
    }
  }, [id, user]);

  const onSignFinish = async (result: any) => {
    try {
      if (contractInstance.template.type === 'publisher_enrollment') {
        // Generic Signing for Enrollment
        await api.post(`/contracts/instances/${id}/sign`, {
          fields: result.fields,
          auditEvent: {
            userId: user?.id,
            action: 'signed',
            timestamp: new Date().toISOString(),
            isFinal: true
          }
        });

        await refreshSession();
        alert('Enrollment contract signed! Redirecting to dashboard...');
        navigate('/', { replace: true });

      } else {
        // Rental agreement signing - use unified endpoint
        await api.post(`/contracts/instances/${id}/sign`, {
          fields: result.fields
        });

        // Redirect to a success state or bookings
        navigate('/bookings', { replace: true });
        alert('Contract signed successfully!');
      }
    } catch (err) {
      console.error('Signing failed:', err);
      alert('Failed to submit signature. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-gray-600 font-medium">Loading your contract...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <FileText size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase">Contract Error</h1>
        <p className="text-gray-500 mb-8 font-medium">{error}</p>
        <button
          onClick={() => navigate('/bookings')}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl active:scale-95"
        >
          Back to Bookings
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/bookings')}
            className="p-2 hover:bg-white rounded-full transition-colors text-slate-400"
          >
            <div className="w-6 h-6 flex items-center justify-center">←</div>
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Review & Sign Agreement</h1>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden min-h-[800px]">
          {signerData && (
            <DocumentSigner
              mode="signer"
              activeStageId={signerData.activeStageId}
              initialData={signerData}
              onFinish={onSignFinish}
              onClose={() => navigate('/bookings')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractSignerPage;

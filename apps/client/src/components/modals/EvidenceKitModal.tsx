import { useState, useEffect } from 'react';
import { X, Shield, FileText, Camera, CreditCard, User, CheckCircle, Download, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import ReputationTool from '../ReputationTool';

interface EvidenceKitModalProps {
  bookingId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function EvidenceKitModal({ bookingId, isOpen, onClose }: EvidenceKitModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const res = await api.get(`/admin/evidence-kit/${bookingId}`);
          setData(res.data);
        } catch (err) {
          setError('Failed to fetch evidence kit');
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-12">
      <div className="bg-white w-full h-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Legal Evidence Kit</h2>
              <p className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em]">Booking Case #BK-{bookingId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 bg-white">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-black uppercase tracking-widest text-slate-400 italic">Consolidating Archive...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-red-500 gap-4">
              <X size={48} className="p-3 bg-red-50 rounded-full" />
              <p className="font-bold">{error}</p>
            </div>
          ) : (
            <div className="space-y-12">
              {/* Section 1: Parties */}
              <section>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-3">
                  <div className="h-px bg-slate-100 flex-1" />
                  Verified Parties
                  <div className="h-px bg-slate-100 flex-1" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-4">Driver (Renter)</p>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center font-bold text-indigo-600 border border-slate-100">
                        {data.renter?.name?.[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{data.renter?.name}</p>
                        <p className="text-xs text-slate-400">{data.renter?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-4">Publisher</p>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center font-bold text-emerald-600 border border-slate-100">
                        {data.publisher?.name?.[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{data.publisher?.name}</p>
                        <p className="text-xs text-slate-400">{data.publisher?.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manual Reputation Adjustment */}
                <div className="mt-8">
                  <ReputationTool
                    userId={data.renter?.id}
                    currentScore={data.renter?.reputationScore || 100}
                  />
                </div>
              </section>

              {/* Section 2: Contract */}
              <section>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-3">
                  <div className="h-px bg-slate-100 flex-1" />
                  Legal Agreement
                  <div className="h-px bg-slate-100 flex-1" />
                </h3>
                <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] p-8 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-white rounded-[1.5rem] text-indigo-600 shadow-sm">
                      <FileText size={32} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 uppercase italic">Digital Contract Instance</p>
                      <p className="text-xs font-bold text-indigo-600">ID: {data.contract?.id} • SIGNED AT: {new Date(data.contract?.signedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <a
                    href={data.contract?.finalPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                  >
                    <Download size={16} /> View Final PDF
                  </a>
                </div>
              </section>

              {/* Section 3: Photo Audits */}
              <section>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-3">
                  <div className="h-px bg-slate-100 flex-1" />
                  Asset Inspection Log
                  <div className="h-px bg-slate-100 flex-1" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {data.audits?.map((audit: any) => (
                    <div key={audit.id} className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <p className="font-black uppercase tracking-widest text-[10px] text-slate-900">{audit.type === 'check_in' ? '🔵 Check-in' : '🟢 Check-out'}</p>
                        <p className="text-[10px] font-bold text-slate-400">{new Date(audit.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(audit.photos || {}).map((url: any, idx) => (
                          <div key={idx} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
                            <img src={url} alt="audit" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 bg-slate-100 rounded-xl inline-block text-[10px] font-black uppercase text-slate-500">
                        Odometer: {audit.odometerReading} KM
                      </div>
                    </div>
                  ))}
                  {(!data.audits || data.audits.length === 0) && (
                    <div className="col-span-2 py-12 text-center bg-slate-50 rounded-[2rem] text-slate-300 font-black uppercase tracking-widest text-xs italic">
                      No photo audits submitted for this case
                    </div>
                  )}
                </div>
              </section>

              {/* Section 4: Payments */}
              <section>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-3">
                  <div className="h-px bg-slate-100 flex-1" />
                  Financial Records
                  <div className="h-px bg-slate-100 flex-1" />
                </h3>
                <div className="p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-full md:w-64 aspect-[3/4] bg-white rounded-2xl overflow-hidden shadow-sm border border-emerald-100">
                    {data.booking?.paymentProofUrl ? (
                      <img src={data.booking.paymentProofUrl} alt="payment proof" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-emerald-200">
                        <CreditCard size={48} />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-2">No Receipt</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-emerald-100">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Declared Amount</p>
                        <p className="text-xl font-black text-slate-900">${data.booking?.totalPrice?.toLocaleString()}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-emerald-100">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Confirmation Status</p>
                        <p className={`text-sm font-black uppercase ${data.booking?.paymentConfirmedAt ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {data.booking?.paymentConfirmedAt ? 'Verified by Publisher' : 'Awaiting Verification'}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-white/50 rounded-2xl">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Metadata Audit</p>
                      <ul className="text-xs text-slate-600 space-y-1 font-bold">
                        <li>• Proof Uploaded: {data.booking?.createdAt ? new Date(data.booking.createdAt).toLocaleString() : 'N/A'}</li>
                        <li>• Receipt URL: <span className="text-indigo-600 break-all">{data.booking?.paymentProofUrl || 'None'}</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-900 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-full">
              <Shield size={16} />
            </div>
            <p className="text-sm font-black uppercase tracking-widest">Sealed Digital Archive</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center gap-2 active:scale-95 transition-all"
          >
            <ExternalLink size={16} /> Export Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

import { X, Check, FileText, ExternalLink, Calendar, MapPin, Gauge } from 'lucide-react';
import { useState } from 'react';

interface VehicleReviewModalProps {
  vehicle: any;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export default function VehicleReviewModal({
  vehicle,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting
}: VehicleReviewModalProps) {
  const [reason, setReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!isOpen || !vehicle) return null;

  const handleReject = () => {
    if (!reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onReject(vehicle.id, reason);
    setReason('');
    setShowRejectInput(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">
              {vehicle.vehicleModel?.brandName} {vehicle.vehicleModel?.modelName}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                {vehicle.plate}
              </span>
              <span className="text-xs font-bold text-slate-400">YEAR: {vehicle.year}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* Vehicle Photo */}
          <div className="w-full h-64 bg-slate-100 rounded-2xl overflow-hidden">
            {vehicle.photos?.[0] ? (
              <img src={vehicle.photos[0]} alt="vehicle" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                No Photo Available
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</p>
            <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-slate-100 pl-4">
              "{vehicle.description}"
            </p>
          </div>

          {/* Vehicle Details Grid */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Vehicle Details</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="px-3 py-2 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-400">Color</p>
                <p className="text-sm font-bold text-slate-700">{vehicle.color}</p>
              </div>
              <div className="px-3 py-2 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-400">Mileage</p>
                <p className="text-sm font-bold text-slate-700">{vehicle.mileage?.toLocaleString()} km</p>
              </div>
              <div className="px-3 py-2 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-400">Location</p>
                <p className="text-sm font-bold text-slate-700 truncate" title={vehicle.idleAddress}>
                  {vehicle.idleAddress?.split(',')[0] || 'N/A'}
                </p>
              </div>
              <div className="px-3 py-2 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-black uppercase text-slate-400">Shifts</p>
                <p className="text-sm font-bold text-slate-700">{vehicle.shifts?.length || 0} available</p>
              </div>
            </div>
          </div>

          {/* Payment & Access Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-[10px] font-black uppercase text-green-700 mb-2">Payment Instructions</p>
              <p className="text-xs text-slate-600 italic">"{vehicle.paymentInstructions || 'Not provided'}"</p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
              <p className="text-[10px] font-black uppercase text-purple-700 mb-2">Access Instructions</p>
              <p className="text-xs text-slate-600 italic">"{vehicle.accessInstructions || 'Not provided'}"</p>
            </div>
          </div>

          {/* Vehicle Documents */}
          <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="text-blue-600" size={20} />
              <h4 className="text-sm font-black uppercase tracking-widest text-blue-900">
                Mandatory Documentation
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Registration Certificate */}
              {vehicle.registrationCertificate && (
                <a
                  href={vehicle.registrationCertificate}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-700">Registration</p>
                      <p className="text-[10px] text-slate-400">Cédula Verde/Azul</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                </a>
              )}

              {/* Proof of Insurance */}
              {vehicle.proofOfInsurance && (
                <a
                  href={vehicle.proofOfInsurance}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-700">Insurance</p>
                      <p className="text-[10px] text-slate-400">Póliza Vigente</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                </a>
              )}

              {/* VTV */}
              {vehicle.technicalInspection && (
                <a
                  href={vehicle.technicalInspection}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-700">VTV / RTO</p>
                      <p className="text-[10px] text-slate-400">Technical Inspection</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                </a>
              )}

              {/* Legacy fallback */}
              {!vehicle.registrationCertificate && vehicle.documentUrls?.map((url: string, idx: number) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-700">
                        Document {idx + 1}
                      </p>
                      <p className="text-[10px] text-slate-400">Legacy Attachment</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                </a>
              ))}
            </div>
            <p className="text-xs text-blue-700 mt-3 italic">
              ⚠️ Verify all documents are valid and up-to-date before approval
            </p>
          </div>

          {/* Publisher Info */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Publisher</p>
            <p className="text-sm font-bold text-slate-700">{vehicle.publisher?.name || 'Unknown'}</p>
            <p className="text-xs text-slate-500">{vehicle.publisher?.email}</p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-50 border-t border-slate-100">
          {showRejectInput ? (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full p-4 rounded-2xl bg-white border-2 border-red-200 text-sm focus:border-red-400 focus:ring-0"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="px-8 py-4 bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => onApprove(vehicle.id)}
                disabled={isApproving}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={18} /> {isApproving ? 'Approving...' : 'Approve Listing'}
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <X size={18} /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

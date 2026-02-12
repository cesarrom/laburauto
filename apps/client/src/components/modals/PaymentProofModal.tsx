import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../lib/api';

interface PaymentProofModalProps {
  bookingId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentProofModal({ bookingId, isOpen, onClose, onSuccess }: PaymentProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload file
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const proofUrl = uploadRes.data.url;

      // 2. Submit proof
      await api.post(`/bookings/${bookingId}/payment/proof`, { proofUrl });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload payment proof');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Upload Payment Proof</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <p className="text-sm text-gray-600 mb-6 text-center">
            Please upload a screenshot of your bank transfer receipt. This will notify the publisher to confirm your booking.
          </p>

          <div
            className={`
              border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer
              ${file ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'}
            `}
            onClick={() => document.getElementById('proof-upload')?.click()}
          >
            <input
              id="proof-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            {file ? (
              <>
                <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                <p className="text-sm font-bold text-green-700 truncate max-w-full px-4">{file.name}</p>
                <p className="text-xs text-green-600 mt-1">Click to change file</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">Tap to select receipt</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 5MB</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!file || isUploading}
            onClick={handleUpload}
            className={`
              flex-[2] py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2
              ${!file || isUploading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95'}
            `}
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit Proof'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

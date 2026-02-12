import { useState } from 'react';
import { X, Camera, AlertCircle, Loader2, Minus, Plus } from 'lucide-react';
import api from '../../lib/api';

interface PhotoAuditModalProps {
  bookingId: number;
  type: 'check_in' | 'check_out';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REQUIRED_PHOTOS = [
  { id: 'front', label: 'Front View' },
  { id: 'back', label: 'Back View' },
  { id: 'left', label: 'Left Side' },
  { id: 'right', label: 'Right Side' },
  { id: 'odometer', label: 'Odometer' },
];

export default function PhotoAuditModal({ bookingId, type, isOpen, onClose, onSuccess }: PhotoAuditModalProps) {
  const [photos, setPhotos] = useState<Record<string, { file: File, url: string }>>({});
  const [odometer, setOdometer] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleFileChange = async (stepId: string, file: File) => {
    const url = URL.createObjectURL(file);
    setPhotos(prev => ({ ...prev, [stepId]: { file, url } }));
  };

  const handleUpload = async () => {
    if (Object.keys(photos).length < REQUIRED_PHOTOS.length) {
      setError('Please capture all required photos');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const photoUrls: Record<string, string> = {};

      // 1. Upload all photos sequentially
      for (const step of REQUIRED_PHOTOS) {
        const formData = new FormData();
        formData.append('file', photos[step.id].file);
        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photoUrls[step.id] = res.data.url;
      }

      // 2. Submit audit
      await api.post('/audits', {
        bookingId,
        type,
        photos: photoUrls,
        odometerReading: odometer,
        metadata: {
          isLive: true,
          timestamp: new Date().toISOString()
        }
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit audit');
    } finally {
      setIsSubmitting(true); // Keep it true or reset? Usually reset on error
      setIsSubmitting(false);
    }
  };

  const currentStepData = currentStep < REQUIRED_PHOTOS.length ? REQUIRED_PHOTOS[currentStep] : REQUIRED_PHOTOS[0]; // Fallback to avoid crash
  const hasCurrentPhoto = currentStep < REQUIRED_PHOTOS.length ? !!photos[currentStepData.id] : false;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full h-full md:max-w-xl md:h-auto md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">
              {type === 'check_in' ? 'Check-in Audit' : 'Check-out Audit'}
            </h2>
            <p className="text-xs font-bold text-indigo-600 uppercase">Step {currentStep + 1} of {REQUIRED_PHOTOS.length + 1}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-2xl transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {currentStep < REQUIRED_PHOTOS.length ? (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900 mb-2">{currentStepData.label}</h3>
                <p className="text-sm text-slate-500">Take a clear photo of the {currentStepData.label.toLowerCase()}</p>
              </div>

              <div
                className={`
                  aspect-video rounded-[2rem] border-4 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all
                  ${hasCurrentPhoto ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-400'}
                `}
                onClick={() => document.getElementById('step-photo-upload')?.click()}
              >
                <input
                  id="step-photo-upload"
                  type="file"
                  capture="environment"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(currentStepData.id, e.target.files[0])}
                />

                {hasCurrentPhoto ? (
                  <img src={photos[currentStepData.id].url} alt="captured" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-16 h-16 text-indigo-200 mb-4" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Tap to Open Camera</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8 py-4">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900 mb-2">Final Step</h3>
                <p className="text-sm text-slate-500">Enter the current odometer reading from the dashboard</p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="text-6xl font-black text-slate-900 tracking-tighter flex items-baseline">
                  {odometer.toLocaleString()}
                  <span className="text-xl text-slate-400 ml-2">KM</span>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setOdometer(prev => Math.max(0, prev - 100))} className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                    <Minus className="text-slate-600" />
                  </button>
                  <button onClick={() => setOdometer(prev => prev + 100)} className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                    <Plus className="text-slate-600" />
                  </button>
                </div>

                <input
                  type="number"
                  value={odometer}
                  onChange={(e) => setOdometer(parseInt(e.target.value) || 0)}
                  className="w-full max-w-xs text-center text-2xl font-bold py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-0"
                  placeholder="000,000"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm font-bold">
              <AlertCircle size={20} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t flex gap-4">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="px-6 py-4 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Back
            </button>
          )}

          <button
            disabled={isSubmitting || (currentStep < REQUIRED_PHOTOS.length && !hasCurrentPhoto)}
            onClick={() => {
              if (currentStep < REQUIRED_PHOTOS.length) {
                setCurrentStep(prev => prev + 1);
              } else {
                handleUpload();
              }
            }}
            className={`
              flex-1 py-4 text-sm font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl
              ${isSubmitting || (currentStep < REQUIRED_PHOTOS.length && !hasCurrentPhoto)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}
            `}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting Audit...
              </>
            ) : (
              currentStep < REQUIRED_PHOTOS.length ? 'Next Photo' : 'Complete Audit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, Upload, FileText, Trash2 } from 'lucide-react';
import { useFileUpload } from '../../hooks/useApi';
import SignedImage from '../SignedImage';

interface EditVehicleModalProps {
  vehicle: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { photos: string[]; documents: string[]; description: string; paymentInstructions: string; accessInstructions: string }) => void;
}

export default function EditVehicleModal({ vehicle, isOpen, onClose, onSave }: EditVehicleModalProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [documents, setDocuments] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useFileUpload();

  // Initialize all fields from vehicle
  useEffect(() => {
    try {
      const vehiclePhotos = vehicle.photos || [];
      setPhotos(Array.isArray(vehiclePhotos) ? vehiclePhotos : []);
    } catch (e) {
      setPhotos([]);
    }

    try {
      const docs = vehicle.documentUrls || [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (e) {
      setDocuments([]);
    }

    setDescription(vehicle.description || '');
    setPaymentInstructions(vehicle.paymentInstructions || '');
    setAccessInstructions(vehicle.accessInstructions || '');
  }, [vehicle]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const urls = await uploadMutation.mutateAsync({ files: Array.from(files), type: 'vehicle' });
      setPhotos(prev => [...prev, ...urls]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const urls = await uploadMutation.mutateAsync({ files: Array.from(files), type: 'kyc' });
      setDocuments(prev => [...prev, ...urls]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (photos.length === 0) {
      alert('Please add at least one photo');
      return;
    }
    if (documents.length === 0) {
      alert('Please add at least one document');
      return;
    }
    if (!description.trim()) {
      alert('Please add a description');
      return;
    }
    if (!paymentInstructions.trim()) {
      alert('Please add payment instructions');
      return;
    }

    onSave({
      photos,
      documents,
      description: description.trim(),
      paymentInstructions: paymentInstructions.trim(),
      accessInstructions: accessInstructions.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Edit Vehicle
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {vehicle.make} {vehicle.model} • {vehicle.plate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* Photos Section */}
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">Vehicle Photos</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  <SignedImage
                    src={photo}
                    alt="Vehicle"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <label className="aspect-video bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                {uploading ? (
                  <span className="text-blue-600 text-sm font-bold">Uploading...</span>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-500 font-semibold">Add Photo</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Documents Section */}
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">Vehicle Documents</h3>
            <div className="space-y-3">
              {documents.map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm text-slate-700 font-semibold truncate">
                      Document {index + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}

              <label className="block p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                <div className="flex flex-col items-center">
                  {uploading ? (
                    <span className="text-blue-600 font-bold">Uploading...</span>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500 font-semibold">Upload Document (PDF/Image)</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.png"
                  multiple
                  className="hidden"
                  onChange={handleDocumentUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-lg font-black text-slate-900 mb-3">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Describe your vehicle..."
            />
          </div>

          {/* Payment Instructions */}
          <div>
            <label className="block text-lg font-black text-slate-900 mb-3">Payment Instructions</label>
            <textarea
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
              rows={3}
              placeholder="How should renters pay you? (e.g., Venmo @username, cash on pickup...)"
            />
          </div>

          {/* Access Instructions */}
          <div>
            <label className="block text-lg font-black text-slate-900 mb-3">
              Access Instructions <span className="text-slate-400 font-normal text-sm">(Optional)</span>
            </label>
            <textarea
              value={accessInstructions}
              onChange={(e) => setAccessInstructions(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
              rows={3}
              placeholder="How do renters access the vehicle? (e.g., key location, parking instructions...)"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-300 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

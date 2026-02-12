import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { DocumentSigner } from '../DocumentSigner';
import { Upload, X } from 'lucide-react';
import type { SDKResult, SignerInitialData } from '@laburauto/shared';

interface TemplateEditorModalProps {
  template: any | null;
  onClose: () => void;
  onSave: () => void;
}

export default function TemplateEditorModal({ template, onClose, onSave }: TemplateEditorModalProps) {
  const [step, setStep] = useState<'details' | 'design'>('details');
  const [name, setName] = useState(template?.name || '');
  const [type, setType] = useState<'publisher_enrollment' | 'rental_agreement'>(
    template?.type || 'rental_agreement'
  );
  const [pdfFileData, setPdfFileData] = useState<SignerInitialData['pdfFile'] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPresetStages = (templateType: string) => {
    const baseStages = [
      { id: 'st_prep', label: 'Variables (Admin)', type: 'prep' },
      { id: 'st_signer_1', label: 'Firma Publisher', type: 'signer', role: 'publisher' },
    ];

    if (templateType === 'rental_agreement') {
      baseStages.push({ id: 'st_signer_2', label: 'Firma Renter', type: 'signer', role: 'driver' });
    }

    return baseStages;
  };

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; pdfUrl: string; fields: any[]; stages: any[] }) => {
      if (template) {
        return await api.put(`/admin/templates/${template.id}`, data);
      } else {
        return await api.post('/admin/templates', data);
      }
    },
    onSuccess: () => {
      alert('Template saved successfully!');
      onSave();
    },
    onError: (error: any) => {
      alert(`Failed to save template: ${error.response?.data?.error || error.message}`);
    }
  });

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    setPdfFileData(new Uint8Array(arrayBuffer) as SignerInitialData['pdfFile']);
  };

  const handleDesignComplete = async (result: SDKResult) => {
    // Upload the PDF first (you'll need an upload endpoint)
    const formData = new FormData();
    formData.append('file', new Blob([result.pdfFile], { type: 'application/pdf' }), 'template.pdf');

    try {
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const pdfUrl = uploadRes.data.url;

      // Save template
      await saveMutation.mutateAsync({
        name,
        type,
        pdfUrl,
        fields: result.fields,
        stages: result.stages
      });
    } catch (error: any) {
      alert(`Failed to upload PDF: ${error.message}`);
    }
  };

  if (step === 'design') {
    if (!pdfFileData) {
      return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
            <p className="text-red-600 font-bold">No PDF loaded. Please go back and upload a PDF.</p>
            <button
              onClick={() => setStep('details')}
              className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <DocumentSigner
        mode="template"
        activeStageId={null}
        lockedStages={true}
        initialData={{
          id: template?.id?.toString() || '',
          pdfFile: pdfFileData!,
          fields: template?.fields || [],
          stages: template?.stages?.length > 0 ? template.stages : getPresetStages(type)
        }}
        onFinish={handleDesignComplete}
        onClose={() => setStep('details')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {template ? 'Edit Template' : 'Create Template'}
            </h2>
            <p className="text-indigo-100 text-sm mt-1">Step 1: Template Details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-black uppercase tracking-wide text-slate-700 mb-2">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 font-bold"
              placeholder="e.g., Standard Rental Agreement"
            />
          </div>

          <div>
            <label className="block text-sm font-black uppercase tracking-wide text-slate-700 mb-2">
              Template Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 font-bold"
            >
              <option value="rental_agreement">Rental Agreement</option>
              <option value="publisher_enrollment">Publisher Enrollment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-black uppercase tracking-wide text-slate-700 mb-2">
              Base PDF Document
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePDFUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex flex-col items-center gap-2 text-slate-600"
            >
              <Upload size={32} className="text-indigo-500" />
              <span className="font-bold">
                {pdfFileData ? '✓ PDF Loaded - Click to Replace' : 'Click to Upload PDF'}
              </span>
              <span className="text-xs text-slate-400">
                Upload the base contract document (PDF format)
              </span>
            </button>
          </div>

          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800 font-bold">
              <strong>Note:</strong> After uploading your PDF, you'll enter design mode where you can:
            </p>
            <ul className="text-xs text-amber-700 mt-2 space-y-1 ml-4 list-disc">
              <li>Add variable fields (static text from data)</li>
              <li>Add input fields (fillable by signers)</li>
              <li>Add signature areas</li>
              <li>Define signing stages (publisher, renter, etc.)</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => setStep('design')}
            disabled={!name || !pdfFileData}
            className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
          >
            Next: Design Fields →
          </button>
        </div>
      </div>
    </div>
  );
}

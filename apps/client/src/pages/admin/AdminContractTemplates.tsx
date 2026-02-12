import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { FileText, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import TemplateEditorModal from '../../components/modals/TemplateEditorModal';

export default function AdminContractTemplates() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-contract-templates'],
    queryFn: async () => {
      const res = await api.get('/admin/templates');
      return res.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contract-templates'] });
      alert('Template deleted successfully');
    }
  });

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsCreating(true);
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setIsCreating(true);
  };

  const handleClose = () => {
    setIsCreating(false);
    setSelectedTemplate(null);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading templates...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Contract Templates</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">
            Manage PDF-based contract templates with multi-stage signing
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
        >
          <Plus size={18} />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {templates?.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
            <FileText className="w-16 h-16 text-slate-200" />
            <p className="text-slate-400 font-black uppercase tracking-widest italic">No templates created yet</p>
          </div>
        ) : templates?.map((template: any) => (
          <div key={template.id} className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex items-center gap-6 hover:shadow-lg transition-all">

            {/* Icon */}
            <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={28} className="text-indigo-600" />
            </div>

            {/* Info */}
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-900">{template.name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {template.type}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {template.stages?.length || 0} stages • {template.fields?.length || 0} fields
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(template)}
                className="p-3 hover:bg-indigo-50 rounded-xl text-indigo-600 transition-all"
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this template?')) {
                    deleteMutation.mutate(template.id);
                  }
                }}
                className="p-3 hover:bg-red-50 rounded-xl text-red-500 transition-all"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isCreating && (
        <TemplateEditorModal
          template={selectedTemplate}
          onClose={handleClose}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-contract-templates'] });
            handleClose();
          }}
        />
      )}
    </div>
  );
}

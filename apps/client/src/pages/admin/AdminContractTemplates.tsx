import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { FileText, Plus, Edit2, Trash2, ShieldCheck } from 'lucide-react';
import TemplateEditorModal from '../../components/modals/TemplateEditorModal';
import AdminDocusealTemplates from './AdminDocusealTemplates';
import { clsx } from 'clsx';

interface ContractTemplateSummary {
  id: number;
  name: string;
  type: 'publisher_enrollment' | 'rental_agreement';
  stages: unknown[];
  fields: unknown[];
}

export default function AdminContractTemplates() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'internal' | 'docuseal'>('internal');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-contract-templates'],
    queryFn: async () => {
      const res = await api.get('/admin/templates');
      return res.data as ContractTemplateSummary[];
    },
    enabled: activeTab === 'internal'
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

  const handleEdit = (template: ContractTemplateSummary) => {
    setSelectedTemplate(template);
    setIsCreating(true);
  };

  const handleClose = () => {
    setIsCreating(false);
    setSelectedTemplate(null);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Sincronizando plantillas</p>
          <p className="mt-2 text-2xl font-display text-text">Cargando contratos…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-text">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Backoffice · Gestión de Contratos</p>
          <h1 className="text-3xl md:text-4xl font-display">
            {activeTab === 'internal' ? 'Definí la estructura de tus contratos.' : 'Sincronizá plantillas reales de DocuSeal.'}
          </h1>
          <p className="text-text-muted max-w-3xl">
            {activeTab === 'internal' 
              ? 'Configurá campos y etapas internas que luego se mapearán a DocuSeal.' 
              : 'Activá las plantillas de DocuSeal para cada tipo de operación (Onboarding o Alquiler).'}
          </p>
        </div>
        {activeTab === 'internal' && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-brand-600 shrink-0"
          >
            <Plus size={18} /> Nueva plantilla
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-surface-muted rounded-2xl border border-border w-fit">
        <button
          onClick={() => setActiveTab('internal')}
          className={clsx(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
            activeTab === 'internal' 
              ? "bg-surface text-brand-600 shadow-sm border border-border" 
              : "text-text-muted hover:text-text"
          )}
        >
          <FileText size={18} />
          Estructura Interna
        </button>
        <button
          onClick={() => setActiveTab('docuseal')}
          className={clsx(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
            activeTab === 'docuseal' 
              ? "bg-surface text-brand-600 shadow-sm border border-border" 
              : "text-text-muted hover:text-text"
          )}
        >
          <ShieldCheck size={18} />
          Catálogo DocuSeal
        </button>
      </div>

      {activeTab === 'docuseal' ? (
        <AdminDocusealTemplates />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates?.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-border rounded-[32px] bg-surface flex flex-col items-center gap-4">
              <FileText className="w-16 h-16 text-text-muted" />
              <p className="text-text-muted">Todavía no cargaste plantillas.</p>
            </div>
          ) : (
            templates!.map((template) => (
              <div key={template.id} className="rounded-[32px] border border-border p-6 shadow-soft hover:shadow-lift transition flex items-center gap-6">
                <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center shrink-0">
                  <FileText size={28} className="text-brand-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-display">{template.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                    <span className="rounded-full border border-border px-3 py-0.5 text-xs uppercase tracking-[0.3em] text-text">
                      {template.type === 'publisher_enrollment' ? 'Publisher onboarding' : 'Publisher ↔ Renter'}
                    </span>
                    <span>{template.stages?.length || 0} etapas • {template.fields?.length || 0} campos</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-3 rounded-2xl border border-border text-text-muted hover:border-brand-500 hover:text-brand-500"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar esta plantilla?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    className="p-3 rounded-2xl border border-border text-red-500 hover:border-red-400"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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

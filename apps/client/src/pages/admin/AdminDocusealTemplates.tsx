import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { RefreshCw, CheckCircle2, XCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface DocusealTemplate {
  id: number;
  docusealTemplateId: string;
  name: string;
  slug: string;
  previewImageUrl: string | null;
  matchesFilter: boolean;
  stageCount: number;
  fieldCount: number;
  submitterCount: number;
  lastSyncedAt: string;
  docusealUrl: string;
  isActivePublisherEnrollment: boolean;
  isActiveRentalAgreement: boolean;
  activations: Record<string, {
    contractType: string;
    activatedAt: string;
    activatedByName: string | null;
    activatedByEmail: string | null;
  }>;
}

export default function AdminDocusealTemplates() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['admin-docuseal-templates'],
    queryFn: async () => {
      console.log('[AdminDocusealTemplates] Fetching templates...');
      const res = await api.get('/admin/docuseal/templates');
      console.log('[AdminDocusealTemplates] Received templates:', res.data);
      return res.data as DocusealTemplate[];
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncing(true);
      console.log('[AdminDocusealTemplates] Syncing with DocuSeal...');
      const res = await api.post('/admin/docuseal/sync');
      console.log('[AdminDocusealTemplates] Sync complete:', res.data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-docuseal-templates'] });
      alert(`Sincronización exitosa: ${data.synced} plantillas procesadas (${data.matchesFilter} coinciden con el filtro).`);
    },
    onError: (err: any) => {
      console.error('[AdminDocusealTemplates] Sync failed:', err);
      alert('Error al sincronizar: ' + (err.response?.data?.details || err.message));
    },
    onSettled: () => setSyncing(false)
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, contractType }: { id: number; contractType: string }) => {
      console.log(`[AdminDocusealTemplates] Activating template ${id} for ${contractType}...`);
      const res = await api.post(`/admin/docuseal/templates/${id}/activate`, { contractType });
      console.log('[AdminDocusealTemplates] Activation response:', res.data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-docuseal-templates'] });
    },
    onError: (err: any) => {
      console.error('[AdminDocusealTemplates] Activation failed:', err);
      alert('Error al activar: ' + (err.response?.data?.details || err.message));
    }
  });

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-border bg-surface p-8 shadow-soft animate-pulse text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Conectando con DocuSeal</p>
        <p className="mt-2 text-2xl font-display text-text">Cargando catálogo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[32px] border border-red-200 bg-red-50 p-8 text-center text-red-600">
        <p className="font-semibold">Error al cargar plantillas de DocuSeal</p>
        <p className="text-sm mt-1">{(error as any).response?.data?.error || (error as any).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-[32px] border border-border shadow-soft">
        <div className="space-y-1">
          <h2 className="text-2xl font-display">Catálogo DocuSeal</h2>
          <p className="text-text-muted text-sm">Sincronizá y activá las plantillas reales que viven en tu instancia de DocuSeal.</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
          className={clsx(
            "inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold shadow-lift transition",
            syncing ? "bg-text-muted cursor-not-allowed" : "bg-brand-500 hover:bg-brand-600 text-white"
          )}
        >
          <RefreshCw size={18} className={clsx(syncing && "animate-spin")} />
          {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {templates?.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-[32px] bg-surface/50 flex flex-col items-center gap-4">
            <RefreshCw className="w-16 h-16 text-text-muted opacity-20" />
            <p className="text-text-muted">No hay plantillas sincronizadas. Hacé clic en sincronizar para empezar.</p>
          </div>
        ) : (
          templates?.map((template) => (
            <div 
              key={template.id} 
              className={clsx(
                "rounded-[32px] border p-6 transition flex flex-col md:flex-row items-start md:items-center gap-6",
                template.matchesFilter ? "border-border bg-surface shadow-soft" : "border-border/50 bg-surface/30 grayscale opacity-60"
              )}
            >
              {/* Preview or Icon */}
              <div className="w-20 h-20 bg-brand-500/5 rounded-2xl flex items-center justify-center shrink-0 border border-border overflow-hidden relative">
                {template.previewImageUrl ? (
                  <img src={template.previewImageUrl} alt={template.name} className="w-full h-full object-cover" />
                ) : (
                  <ShieldCheck size={32} className="text-brand-500/40" />
                )}
                {!template.matchesFilter && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <XCircle size={20} className="text-text-muted" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-display leading-none">{template.name}</h3>
                  {template.matchesFilter ? (
                    <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100">
                      Coincide con filtro
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-gray-200">
                      Fuera de filtro
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>ID: {template.docusealTemplateId}</span>
                  <span>•</span>
                  <span>{template.submitterCount} firmantes</span>
                  <span>•</span>
                  <span>Sincronizado: {new Date(template.lastSyncedAt).toLocaleString('es-AR')}</span>
                </div>
                
                {/* Active Badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {template.isActivePublisherEnrollment && (
                    <div className="flex items-center gap-1.5 bg-brand-50 text-brand-700 px-3 py-1 rounded-xl border border-brand-100 text-xs font-medium">
                      <CheckCircle2 size={14} />
                      Activa: Onboarding Publisher
                    </div>
                  )}
                  {template.isActiveRentalAgreement && (
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-xl border border-blue-100 text-xs font-medium">
                      <CheckCircle2 size={14} />
                      Activa: Alquiler (P2P)
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <a 
                  href={template.docusealUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl border border-border text-text-muted hover:border-brand-500 hover:text-brand-500 transition-colors"
                  title="Ver en DocuSeal"
                >
                  <ExternalLink size={18} />
                </a>
                
                <div className="h-8 w-px bg-border mx-1 hidden md:block" />

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    disabled={!template.matchesFilter || activateMutation.isPending}
                    onClick={() => activateMutation.mutate({ id: template.id, contractType: 'publisher_enrollment' })}
                    className={clsx(
                      "flex-1 md:flex-none text-xs font-bold px-4 py-3 rounded-2xl border transition-all",
                      template.isActivePublisherEnrollment 
                        ? "bg-brand-500 text-white border-brand-500 shadow-lift"
                        : "border-border text-text-muted hover:border-brand-500/30 hover:bg-brand-50/50"
                    )}
                  >
                    USAR PARA ONBOARDING
                  </button>
                  <button
                    disabled={!template.matchesFilter || activateMutation.isPending}
                    onClick={() => activateMutation.mutate({ id: template.id, contractType: 'rental_agreement' })}
                    className={clsx(
                      "flex-1 md:flex-none text-xs font-bold px-4 py-3 rounded-2xl border transition-all",
                      template.isActiveRentalAgreement 
                        ? "bg-blue-600 text-white border-blue-600 shadow-lift"
                        : "border-border text-text-muted hover:border-blue-500/30 hover:bg-blue-50/50"
                    )}
                  >
                    USAR PARA ALQUILER
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

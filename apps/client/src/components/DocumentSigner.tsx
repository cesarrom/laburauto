import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Field, Stage, SDKResult, FieldType, SignerInitialData } from '@laburauto/shared';

import {
  PenTool,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckSquare,
  Save,
  ListOrdered,
  AlertCircle,
  Tag
} from 'lucide-react';

// Initialize worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Datos iniciales que recibe el SDK
export interface DocumentSignerProps {
  mode: 'template' | 'prepare' | 'signer' | 'view';
  activeStageId: string | null;
  initialData: SignerInitialData;
  onFinish: (result: SDKResult) => void;
  onClose: () => void;
  lockedStages?: boolean;
}

// Tipo para la referencia de control de renderizado (renderTaskRef)
// Basado en la API de PDF.js
interface InternalRenderTask {
  promise: Promise<void>; // Promesa que se resuelve cuando el renderizado termina
  cancel: () => void;     // Método para abortar el renderizado en curso
}

/**
 * ============================================================================
 * FIRMAYA SDK - VERSION ORQUESTADOR (FIXED LOADING ENGINE)
 * ============================================================================
 */

const AVAILABLE_VARIABLES = [
  { value: 'publisher_name', label: 'Nombre Publisher' },
  { value: 'publisher_email', label: 'Email Publisher' },
  { value: 'renter_name', label: 'Nombre Renter' },
  { value: 'renter_email', label: 'Email Renter' },
  { value: 'vehicle_make', label: 'Marca Vehículo' },
  { value: 'vehicle_model', label: 'Modelo Vehículo' },
  { value: 'vehicle_plate', label: 'Patente Vehículo' },
  { value: 'booking_id', label: 'ID Reserva' },
  { value: 'contract_id', label: 'ID Contrato' },
  { value: 'date_full', label: 'Fecha Completa' },
  { value: 'date_short', label: 'Fecha Corta' },
  { value: 'date_iso', label: 'Fecha ISO' },
];
export const DocumentSigner = ({
  mode = 'template',
  activeStageId = null,
  initialData,
  onFinish,
  onClose,
  lockedStages = false
}: DocumentSignerProps) => {
  const [pdfFile] = useState(initialData.pdfFile || null);
  const [pdfDoc, setPdfDoc] = useState<any>(null); // pdfjsLib.PDFDocumentProxy
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [fields, setFields] = useState<Field[]>(initialData.fields || []);
  const [stages, setStages] = useState<Stage[]>(initialData.stages || [
    { id: 'st_prep', label: 'Preparación (Emisor)', type: 'prep' }
  ]);
  const [selectedStageId, setSelectedStageId] = useState(initialData.stages?.[0]?.id || 'st_prep');
  const [scale] = useState(1.3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<{ fieldId: string; query: string } | null>(null);
  const [showVarSelector, setShowVarSelector] = useState<string | null>(null); // field.id

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<InternalRenderTask | null>(null);
  const loadingDocRef = useRef(false);

  // 2. Efecto de carga de documento (Independiente del renderizado)
  useEffect(() => {
    if (!pdfFile || loadingDocRef.current) return;

    const loadPDF = async () => {
      loadingDocRef.current = true;
      setIsProcessing(true);
      setError(null);

      try {
        // Clonamos el buffer para evitar el error de "detached ArrayBuffer"
        const loadingTask = pdfjsLib.getDocument({
          data: pdfFile.slice(0),
          stopAtErrors: false
        });

        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        console.error("Error cargando documento PDF:", err);
        setError("No se pudo cargar el archivo PDF. Verifica el formato.");
      } finally {
        setIsProcessing(false);
        loadingDocRef.current = false;
      }
    };

    loadPDF();
  }, [pdfFile]);

  // 3. Efecto de renderizado de página (Solo cuando el doc está listo)
  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
    return () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, currentPage, scale]);

  const renderPage = async (pageNo: number) => {
    try {
      // Cancelar tarea previa antes de iniciar una nueva
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try { await renderTaskRef.current.promise; } catch (e) { }
      }

      const page = await pdfDoc.getPage(pageNo);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error("Error de renderizado:", err);
      }
    }
  };

  // --- Lógica de Negocio ---
  const addStage = () => {
    const newStage: Stage = { id: `st_${Date.now()}`, label: `Firmante ${stages.length}`, type: 'signer' };
    setStages([...stages, newStage]);
    setSelectedStageId(newStage.id);
  };

  const removeStage = (id: string) => {
    if (id === 'st_prep') return;
    setStages(stages.filter(s => s.id !== id));
    setFields(fields.filter(f => f.stageId !== id));
    if (selectedStageId === id) setSelectedStageId('st_prep');
  };

  const createField = (type: FieldType, x: number, y: number) => {
    // Determine target stage
    let targetStageId = selectedStageId;

    if (lockedStages) {
      if (type === 'variable') {
        targetStageId = 'st_prep';
      } else if (selectedStageId === 'st_prep') {
        // If trying to drop an input/signature in the variables stage, move it to the first signer stage
        const firstSigner = stages.find(s => s.type === 'signer');
        if (firstSigner) targetStageId = firstSigner.id;
      }
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      stageId: targetStageId,
      label: type === 'variable' ? `Variable_${fields.filter(f => f.type === 'variable').length + 1}` : `Input_${fields.length + 1}`,
      x, y,
      width: type === 'signature' ? 160 : 140,
      height: type === 'signature' ? 60 : 32,
      page: currentPage,
      value: '',
      isSigned: false,
      signatureData: null
    };
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    if (mode !== 'template' || !e.dataTransfer) return;
    e.preventDefault();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 20;
    const y = e.clientY - rect.top - 15;

    const fieldId = e.dataTransfer.getData('fieldId');
    const type = e.dataTransfer.getData('fieldType') as FieldType;

    if (fieldId) {
      // Move existing field
      updateField(fieldId, { x, y });
    } else if (type) {
      // Create new field
      setFields([...fields, createField(type, x, y)]);
    }
  };

  const updateField = (id: string, updates: Partial<Field>) => setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));

  const getFieldBehavior = (field: Field) => {
    if (mode === 'template') return 'design';
    if (mode === 'view') return 'readonly';

    const activeIdx = stages.findIndex(s => s.id === activeStageId);
    const fieldIdx = stages.findIndex(s => s.id === field.stageId);

    if (fieldIdx < activeIdx) return 'readonly';
    if (fieldIdx === activeIdx) return 'editable';
    return 'hidden';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-0 md:p-6 overflow-hidden text-slate-800">
      <div className="bg-white w-full h-full md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10">

        {/* SDK Header */}
        <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
              <ListOrdered size={20} />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-widest leading-none mb-1">
                {mode === 'template' ? 'Constructor de Contrato' : 'Proceso de Firma'}
              </h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                {mode === 'template' ? 'Diseñando etapas y variables' : `Activo: ${stages.find(s => s.id === activeStageId)?.label}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors"><X size={20} /></button>
            {mode !== 'view' && (
              <button
                onClick={() => onFinish({ id: initialData.id || '', fields, stages, pdfFile, timestamp: new Date().toISOString() })}
                className="px-8 py-3 rounded-2xl text-white font-bold text-sm flex items-center gap-2 transition-all active:scale-95 bg-slate-900 hover:bg-black shadow-xl"
              >
                <Save size={18} /> Finalizar Paso
              </button>
            )}
          </div>
        </header>

        <main className="flex flex-1 overflow-hidden bg-slate-50/50">
          {/* SIDEBAR */}
          <aside className="w-85 bg-white border-r border-slate-100 flex flex-col shrink-0 z-10">
            {mode === 'template' && (
              <div className="p-6 border-b border-slate-50">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-5 text-left">Herramientas</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { t: 'variable', icon: Tag, label: 'Variable', color: 'text-blue-500', allowedIn: ['prep'] },
                    { t: 'input', icon: CheckSquare, label: 'Input', color: 'text-amber-500', allowedIn: ['signer'] },
                    { t: 'signature', icon: PenTool, label: 'Firma', color: 'text-emerald-500', allowedIn: ['signer'] }
                  ].map(item => {
                    const currentStageType = stages.find(s => s.id === selectedStageId)?.type;
                    const isAppropriate = !lockedStages || item.allowedIn.includes(currentStageType as any);

                    return (
                      <div
                        key={item.t} draggable onDragStart={e => e.dataTransfer.setData('fieldType', item.t)}
                        className={`
                          flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed transition-all group cursor-grab
                          ${isAppropriate ? 'border-slate-100 hover:border-indigo-400 hover:bg-indigo-50' : 'opacity-30 grayscale border-transparent cursor-not-allowed'}
                        `}
                      >
                        <item.icon size={16} className={`${item.color}`} />
                        <span className="text-[8px] font-bold uppercase">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stages del Workflow</h3>
                {mode === 'template' && !lockedStages && <button onClick={addStage} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg transition-colors"><Plus size={16} /></button>}
              </div>

              {lockedStages && mode === 'template' && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                  <p className="text-[9px] font-bold text-amber-700 leading-tight">
                    Workflow stages are fixed for this template type. Select a stage below to place its fields.
                  </p>
                </div>
              )}

              {stages
                .filter(s => mode !== 'signer' || s.id === activeStageId)
                .map((stage) => {
                  const isSignerActive = mode === 'signer' && stage.id === activeStageId;

                  return (
                    <div
                      key={stage.id}
                      onClick={() => mode === 'template' && setSelectedStageId(stage.id)}
                      className={mode === 'signer' ? "" : `
                        rounded-2xl border-2 p-4 transition-all cursor-pointer text-left
                        ${selectedStageId === stage.id && mode === 'template' ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100 bg-slate-50'}
                        ${activeStageId === stage.id ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}
                      `}
                    >
                      {mode !== 'signer' ? (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">{stage.type === 'prep' ? "⚙️ " : "👤 "}{stage.label}</span>
                          {mode === 'template' && !lockedStages && stage.id !== 'st_prep' && (
                            <button onClick={(e) => { e.stopPropagation(); removeStage(stage.id); }} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                          )}
                          {lockedStages && selectedStageId === stage.id && (
                            <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase font-black">Active</span>
                          )}
                        </div>
                      ) : (
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <div className="w-1 h-1 bg-indigo-600 rounded-full"></div>
                          Campos Requeridos
                        </h3>
                      )}

                      <div className="space-y-2">
                        {fields.filter(f => f.stageId === stage.id).map(f => (
                          <div key={f.id} className={`p-3 rounded-xl border transition-all ${isSignerActive ? 'bg-indigo-50/30 border-indigo-100 shadow-sm' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[8px] font-black text-slate-300 uppercase">{f.type === 'variable' ? 'Dato del Sistema' : f.type}</span>
                              {mode === 'template' && <button onClick={() => setFields(fields.filter(field => field.id !== f.id))}><X size={8} /></button>}
                            </div>
                            {mode === 'template' ? (
                              <div className="relative w-full h-full">
                                <input
                                  className="w-full text-[10px] font-bold border-none p-0 focus:ring-0 uppercase bg-transparent h-full px-1"
                                  value={f.label}
                                  onFocus={() => f.type === 'variable' && setShowVarSelector(f.id)}
                                  onBlur={() => setTimeout(() => setShowVarSelector(null), 200)}
                                  onChange={e => updateField(f.id, { label: e.target.value })}
                                />
                                {showVarSelector === f.id && (
                                  <div className="absolute top-full left-0 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                    <div className="p-2 bg-slate-50 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                      Select Variable
                                    </div>
                                    {AVAILABLE_VARIABLES.filter(v => v.label.includes(f.label.toLowerCase()) || f.label === '').map(v => (
                                      <button
                                        key={v.value}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          updateField(f.id, { label: v.label });
                                          setShowVarSelector(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-slate-50 last:border-0"
                                      >
                                        {v.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (mode === 'prepare' && f.stageId === activeStageId) || (mode === 'signer' && f.stageId === activeStageId && f.type === 'input') ? (
                              <input className="w-full text-[10px] font-bold text-blue-600 bg-white border border-blue-100 p-2 rounded-lg focus:ring-2 focus:ring-blue-200 transition-all outline-none" value={f.value} onChange={e => updateField(f.id, { value: e.target.value })} placeholder="..." />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 block px-1">{f.value || f.label}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>

          {/* ÁREA DE DOCUMENTO */}
          <section className="flex-1 overflow-auto bg-slate-200/40 p-12 flex flex-col items-center relative" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-4">
                <AlertCircle size={48} />
                <p className="font-bold">{error}</p>
              </div>
            ) : pdfDoc ? (
              <div className="relative shadow-2xl bg-white border border-slate-300" ref={containerRef}>
                <canvas ref={canvasRef} className="rounded-sm" />

                {fields.filter(f => f.page === currentPage).map(field => {
                  const behavior = getFieldBehavior(field);
                  return (
                    <div
                      key={field.id}
                      draggable={behavior === 'design'}
                      onDragStart={(e) => {
                        if (behavior !== 'design') return;
                        e.dataTransfer.setData('fieldId', field.id);
                        // Make sure we don't trigger the "add new field" logic
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      style={{ position: 'absolute', left: field.x, top: field.y, width: field.width, height: field.height }}
                      className={`
                        flex flex-col rounded-lg overflow-hidden border-2 transition-all group
                        ${behavior === 'design' ? 'border-indigo-500 border-dashed bg-blue-50/30 cursor-move' : ''}
                        ${behavior === 'editable' ? 'border-blue-600 shadow-lg bg-white z-20 scale-105' : 'border-slate-100 bg-white/60'}
                        ${behavior === 'hidden' ? 'opacity-0 select-none' : ''}
                      `}
                    >
                      <div className={`h-4 text-[8px] font-black px-2 flex items-center uppercase ${behavior === 'editable' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {field.label}
                      </div>
                      <div className="flex-1 relative">
                        {field.type === 'signature' ? (
                          <SDKSignaturePad field={field} isEditable={behavior === 'editable'} onSign={(data) => updateField(field.id, { isSigned: true, signatureData: data })} />
                        ) : (
                          <>
                            <input
                              disabled={behavior !== 'editable' && behavior !== 'design'}
                              className={`w-full h-full px-2 text-[11px] font-bold border-none outline-none focus:ring-0 bg-transparent ${field.type === 'variable' && behavior === 'readonly' ? 'text-slate-800' : 'text-blue-600'}`}
                              value={behavior === 'design' ? field.label : field.value}
                              onChange={e => {
                                const val = e.target.value;
                                if (behavior === 'design') {
                                  updateField(field.id, { label: val });
                                  if (field.type === 'variable') {
                                    const lastOpen = val.lastIndexOf('{{');
                                    const lastClose = val.lastIndexOf('}}');
                                    if (lastOpen !== -1 && lastOpen > lastClose) {
                                      const query = val.slice(lastOpen + 2);
                                      setAutocomplete({ fieldId: field.id, query: query.trim() });
                                    } else {
                                      setAutocomplete(null);
                                    }
                                  }
                                } else {
                                  updateField(field.id, { value: val });
                                }
                              }}
                              onBlur={() => setTimeout(() => setAutocomplete(null), 200)}
                            />
                            {autocomplete?.fieldId === field.id && (
                              <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-xl z-[150] max-h-40 overflow-y-auto">
                                {AVAILABLE_VARIABLES.filter(v => v.value.includes(autocomplete.query)).map(v => (
                                  <div
                                    key={v.value}
                                    onClick={() => {
                                      const lastOpen = field.label.lastIndexOf('{{');
                                      const prefix = field.label.slice(0, lastOpen);
                                      updateField(field.id, { label: `${prefix}{{${v.value}}}` });
                                      setAutocomplete(null);
                                    }}
                                    className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-[10px] font-bold text-slate-700 flex flex-col"
                                  >
                                    <span>{v.label}</span>
                                    <span className="text-[8px] text-slate-400">{'{{' + v.value + '}}'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-sm font-black animate-pulse uppercase tracking-widest italic text-center">
                  {isProcessing ? 'Preparando Motor PDF...' : 'Esperando Documento...'}
                </p>
              </div>
            )}

            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl z-50">
              <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="hover:text-indigo-400 disabled:opacity-20"><ChevronLeft size={20} /></button>
              <span className="text-sm font-black">{currentPage} / {numPages}</span>
              <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)} className="hover:text-indigo-400 disabled:opacity-20"><ChevronRight size={20} /></button>
            </div>
          </section>
        </main>
      </div>
    </div >
  );
};

export const SDKSignaturePad = ({ field, isEditable, onSign }: { field: any; isEditable: boolean; onSign: (data: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (field.signatureData && canvasRef.current) {
      const img = new Image();
      img.onload = () => canvasRef.current?.getContext('2d')?.drawImage(img, 0, 0);
      img.src = field.signatureData;
    }
  }, [field.signatureData]);

  const handleAction = (e: any, start: boolean) => {
    if (!isEditable) return;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !rect || !ctx) return;
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    if (start) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    } else {
      ctx.lineTo(x, y); ctx.stroke();
    }
  };

  return (
    <canvas ref={canvasRef} width={field.width} height={field.height - 16} className={`w-full h-full ${isEditable ? 'cursor-crosshair' : ''}`}
      onMouseDown={e => handleAction(e, true)} onMouseMove={e => !e.buttons ? null : handleAction(e, false)} onMouseUp={() => isEditable && onSign(canvasRef.current?.toDataURL() || '')}
    />
  );
};
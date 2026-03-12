/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Car, User as UserIcon, FileText, ChevronRight, ChevronLeft, Shield, Star, CreditCard, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompleteOnboarding, useFileUpload, useSubmitRenterDocuments, useCreateContractInstance, useResendEnrollment } from '../hooks/useApi';
import { kycSchema, type KYCData, renterDocumentsSchema, type RenterDocumentsData } from '../schemas/validation';
import IconRadioCard from '../components/IconRadioCard';

export default function Onboarding() {
  const { user, updateUser, login, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [selectedRole, setSelectedRole] = useState<'publisher' | 'driver' | null>(null);

  // Resume flow detection & Completion Redirect
  useEffect(() => {
    if (user?.onboardingCompleted) {
      navigate('/');
      return;
    }

    if (user?.role === 'publisher' && !user.onboardingCompleted) {
      setStep(4);
    }
  }, [user, navigate]);

  const completeMutation = useCompleteOnboarding();
  const uploadMutation = useFileUpload();
  const submitDocsMutation = useSubmitRenterDocuments();
  const createContractMutation = useCreateContractInstance();
  const resendMutation = useResendEnrollment();

  const handleResendEmail = () => {
    resendMutation.mutate(undefined, {
      onSuccess: () => alert('¡Email de inscripción reenviado con éxito!'),
      onError: (err: any) => alert(err.response?.data?.error || 'Error al reenviar el email'),
    });
  };

  const {
    register: registerKYC,
    handleSubmit: handleSubmitKYC,
    formState: { errors: kycErrors }
  } = useForm<KYCData>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      fullName: user?.name || '',
    },
  });

  const {
    register: registerDocs,
    handleSubmit: handleSubmitDocs,
    formState: { errors: docsErrors },
    setValue: setDocsValue,
    watch: watchDocs,
  } = useForm<RenterDocumentsData>({
    resolver: zodResolver(renterDocumentsSchema),
  });

  const handleKYCSubmit = (data: KYCData) => {
    setKycData(data);
    setStep(2);
  };

  const handleRoleSelect = (role: 'publisher' | 'driver') => {
    setSelectedRole(role);

    // If driver, go to documents step; if publisher, go to enrollment contract step
    // The enrollment flow will now wait for templates to be fetched if needed
    if (role === 'driver') {
      setStep(3);
    } else {
      // We will trigger the next step when the user confirms their role choice
      // But for better UX let's wait a moment or let 'handleStartPublisherEnrollment' handle it
      // Actually, standardizing on the 'Continue' button logic in Step 2 is better
      // But the existing code had handleRoleSelect trigger logic. 
      // The Step 2 button calls `selectedRole && handleRoleSelect(selectedRole)`
      handleStartPublisherEnrollment();
    }
  };

  const handleStartPublisherEnrollment = async () => {
    if (!user) return;

    try {
      await createContractMutation.mutateAsync({
        contractType: 'publisher_enrollment',
        publisherId: user.id
      });

      // After creating the instance, we complete onboarding (setting role and KYC)
      // and then move to step 4 which tells them to check email.
      await handleCompleteOnboarding('publisher');
    } catch (error) {
      console.error('Failed to start enrollment:', error);
      // Fallback: still complete onboarding so they can try again from dashboard if needed
      handleCompleteOnboarding('publisher');
    }
  };

  const handleDocumentsSubmit = async (data: RenterDocumentsData) => {
    if (!user) return;

    try {
      await submitDocsMutation.mutateAsync({
        userId: user.id,
        ...data,
      });

      // Complete onboarding
      await handleCompleteOnboarding('driver');
    } catch (error: any) {
      console.error('Failed to submit documents:', error);
      alert(error.response?.data?.error || 'Failed to submit documents');
    }
  };

  const handleCompleteOnboarding = async (role: 'publisher' | 'driver') => {
    if (!user || !kycData) return;

    try {
      const { user: updatedUser, token: newToken } = await completeMutation.mutateAsync({
        userId: user.id,
        role,
        kycData: JSON.stringify(kycData),
      });

      // Validating new token existence if essential for role update
      if (newToken) {
        // Login updates both token and user state
        login(newToken, updatedUser);
      } else {
        updateUser(updatedUser);
      }

      // Redirect based on role
      if (role === 'publisher') {
        // Show Check Email step
        setStep(4);
        // navigate('/publish-vehicle');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      console.error('Onboarding failed:', error);
      alert(error.response?.data?.error || 'Failed to complete onboarding');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof RenterDocumentsData) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const urls = await uploadMutation.mutateAsync({ files: Array.from(files), type: 'kyc' });
      if (urls.length > 0) {
        setDocsValue(fieldName, urls[0]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file');
    }
  };

  if (!user) return null;

  const totalSteps = 3; // Always 3 steps now

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl animate-fade-up">
        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4 relative">
            {/* Background Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2 z-0" />
            
            {Array.from({ length: totalSteps }).map((_, i) => {
              const stepNum = i + 1;
              const isActive = step >= stepNum;
              const isCompleted = step > stepNum;
              
              return (
                <div key={stepNum} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-all duration-300 shadow-sm ${
                      isActive
                        ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                        : 'bg-surface border-2 border-border text-text-muted'
                    }`}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-text-muted px-1">
            <span className={step >= 1 ? 'text-brand-500' : ''}>Verificación</span>
            <span className={step >= 2 ? 'text-brand-500' : ''}>Rol</span>
            <span className={step >= 3 ? 'text-brand-500' : ''}>
              {selectedRole === 'publisher' ? 'Contrato' : 'Documentos'}
            </span>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          {step === 1 && (
            <form onSubmit={handleSubmitKYC(handleKYCSubmit)} className="p-8 space-y-8">
              <div className="text-center">
                <div className="inline-flex p-4 bg-brand-500/10 rounded-2xl mb-6">
                  <FileText className="h-10 w-10 text-brand-500" />
                </div>
                <h2 className="text-3xl font-display font-bold text-text">Verificación de Identidad</h2>
                <p className="text-text-muted mt-3 text-lg">
                  Necesitamos verificar tu identidad para garantizar la seguridad de todos.
                </p>
              </div>

              <div className="space-y-5">
                <div className="group">
                  <label className="block text-sm font-semibold text-text-muted mb-2 group-focus-within:text-brand-500 transition-colors">
                    Nombre Completo
                  </label>
                  <input
                    {...registerKYC('fullName')}
                    disabled
                    className="w-full px-5 py-4 rounded-xl border border-border bg-surface-muted cursor-not-allowed text-text-muted font-medium"
                    placeholder="Juan Pérez"
                  />
                  {kycErrors.fullName && (
                    <p className="text-red-500 text-sm mt-2 font-medium">{kycErrors.fullName.message}</p>
                  )}
                </div>

                <div className="group">
                  <label className="block text-sm font-semibold text-text-muted mb-2 group-focus-within:text-brand-500 transition-colors">
                    DNI / Pasaporte
                  </label>
                  <input
                    {...registerKYC('idNumber')}
                    className="w-full px-5 py-4 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-text font-medium"
                    placeholder="12.345.678"
                  />
                  {kycErrors.idNumber && (
                    <p className="text-red-500 text-sm mt-2 font-medium">{kycErrors.idNumber.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="group">
                    <label className="block text-sm font-semibold text-text-muted mb-2 group-focus-within:text-brand-500 transition-colors">
                      Fecha de Nacimiento
                    </label>
                    <input
                      type="date"
                      {...registerKYC('dateOfBirth')}
                      className="w-full px-5 py-4 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-text font-medium"
                    />
                    {kycErrors.dateOfBirth && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{kycErrors.dateOfBirth.message}</p>
                    )}
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-text-muted mb-2 group-focus-within:text-brand-500 transition-colors">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      {...registerKYC('phone')}
                      className="w-full px-5 py-4 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-text font-medium"
                      placeholder="+54 11 1234-5678"
                    />
                    {kycErrors.phone && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{kycErrors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-semibold text-text-muted mb-2 group-focus-within:text-brand-500 transition-colors">
                    Dirección
                  </label>
                  <input
                    {...registerKYC('address')}
                    className="w-full px-5 py-4 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-text font-medium"
                    placeholder="Calle 123, Ciudad"
                  />
                  {kycErrors.address && (
                    <p className="text-red-500 text-sm mt-2 font-medium">{kycErrors.address.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 group active:scale-[0.98]"
              >
                Continuar
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="p-8 space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-display font-bold text-text">Elige tu Perfil</h2>
                <p className="text-text-muted mt-3 text-lg">
                  ¿Quieres publicar vehículos o alquilarlos?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IconRadioCard
                  id="publisher"
                  value="publisher"
                  label="Dueño"
                  description="Publica tus vehículos para alquilar"
                  icon={Car}
                  selected={selectedRole === 'publisher'}
                  onChange={(value) => setSelectedRole(value as 'publisher' | 'driver')}
                />
                <IconRadioCard
                  id="driver"
                  value="driver"
                  label="Chofer"
                  description="Busca vehículos para trabajar"
                  icon={UserIcon}
                  selected={selectedRole === 'driver'}
                  onChange={(value) => setSelectedRole(value as 'publisher' | 'driver')}
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-surface border border-border text-text py-4 rounded-xl font-bold hover:bg-surface-muted transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={20} />
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => selectedRole && handleRoleSelect(selectedRole)}
                  disabled={!selectedRole || completeMutation.isPending}
                  className="flex-1 bg-brand-500 text-white py-4 rounded-xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Continuar
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              {completeMutation.isError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-5 py-4 rounded-xl text-sm font-medium">
                  {completeMutation.error?.message || 'Error al completar el registro'}
                </div>
              )}
            </div>
          )}

          {step === 3 && selectedRole === 'driver' && (
            <form onSubmit={handleSubmitDocs(handleDocumentsSubmit)} className="p-8 space-y-8">
              <div className="text-center">
                <div className="inline-flex p-4 bg-green-500/10 rounded-2xl mb-6">
                  <Shield className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-display font-bold text-text">Verificación de Chofer</h2>
                <p className="text-text-muted mt-3 text-lg">
                  Sube tus calificaciones y antecedentes para empezar.
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-6">
                  <h3 className="font-bold text-text mb-2 flex items-center gap-2">
                    <Star className="h-5 w-5 text-brand-500" />
                    Calificaciones de Apps
                  </h3>
                  <p className="text-sm text-text-muted mb-6">Capturas de pantalla de tus perfiles (mínimo una)</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {['uberRating', 'cabifyRating', 'indriveRating', 'didiRating'].map((field) => {
                      const fieldValue = watchDocs(field as keyof RenterDocumentsData);
                      const isUploaded = !!fieldValue;

                      return (
                        <div key={field} className="relative group">
                          <label className="block text-sm font-semibold text-text-muted mb-2 capitalize">
                            {field.replace('Rating', '')}
                          </label>
                          <div className={`relative rounded-xl border-2 border-dashed transition-all duration-300 ${
                            isUploaded 
                              ? 'border-green-500/50 bg-green-500/5' 
                              : 'border-border hover:border-brand-500/50'
                          }`}>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileUpload(e, field as keyof RenterDocumentsData)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="p-4 text-center">
                              {isUploaded ? (
                                <span className="text-green-500 text-sm font-bold flex items-center justify-center gap-2">
                                  ✓ Cargado
                                </span>
                              ) : (
                                <span className="text-text-muted text-sm font-medium">Click para subir</span>
                              )}
                            </div>
                          </div>
                          <input type="hidden" {...registerDocs(field as any)} />
                        </div>
                      );
                    })}
                  </div>

                  {docsErrors.uberRating && (
                    <p className="text-red-500 text-sm mt-4 font-medium">
                      {docsErrors.uberRating.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-brand-500/30">
                    <h3 className="font-bold text-text mb-2 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-brand-500" />
                      Foto del DNI
                    </h3>
                    <p className="text-xs text-text-muted mb-4">Obligatorio</p>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, 'dniPhoto')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`p-4 text-center rounded-xl border-2 border-dashed transition-all ${
                        watchDocs('dniPhoto') ? 'border-green-500/50 bg-green-500/5' : 'border-border'
                      }`}>
                        <span className="text-sm font-medium text-text-muted">
                          {watchDocs('dniPhoto') ? '✓ Cargado' : 'Subir foto'}
                        </span>
                      </div>
                    </div>
                    <input type="hidden" {...registerDocs('dniPhoto')} />
                    {docsErrors.dniPhoto && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{docsErrors.dniPhoto.message}</p>
                    )}
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-brand-500/30">
                    <h3 className="font-bold text-text mb-2 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-brand-500" />
                      Antecedentes
                    </h3>
                    <p className="text-xs text-text-muted mb-4">Obligatorio</p>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, 'criminalBackground')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`p-4 text-center rounded-xl border-2 border-dashed transition-all ${
                        watchDocs('criminalBackground') ? 'border-green-500/50 bg-green-500/5' : 'border-border'
                      }`}>
                        <span className="text-sm font-medium text-text-muted">
                          {watchDocs('criminalBackground') ? '✓ Cargado' : 'Subir certificado'}
                        </span>
                      </div>
                    </div>
                    <input type="hidden" {...registerDocs('criminalBackground')} />
                    {docsErrors.criminalBackground && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{docsErrors.criminalBackground.message}</p>
                    )}
                  </div>
                </div>

                {docsErrors.root && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-5 py-4 rounded-xl text-sm font-medium">
                    {docsErrors.root.message}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 bg-surface border border-border text-text py-4 rounded-xl font-bold hover:bg-surface-muted transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={20} />
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending || submitDocsMutation.isPending || completeMutation.isPending}
                  className="flex-1 bg-brand-500 text-white py-4 rounded-xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {(uploadMutation.isPending || submitDocsMutation.isPending || completeMutation.isPending) ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Finalizar
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && selectedRole === 'publisher' && (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-16 h-16 animate-spin text-brand-500 mb-6" />
                <h3 className="text-2xl font-display font-bold text-text mb-2">Preparando Contrato</h3>
                <p className="text-text-muted text-lg">Estamos generando tu contrato de inscripción...</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="p-12 text-center">
              <div className="inline-flex p-6 bg-brand-500/10 rounded-full mb-8">
                <Mail className="h-16 w-16 text-brand-500 animate-bounce" />
              </div>
              <h2 className="text-4xl font-display font-bold text-text mb-4">Revisa tu Email</h2>
              <p className="text-xl text-text-muted mb-10 max-w-md mx-auto">
                Te enviamos un contrato para firmar. Revisa tu bandeja de entrada para completar tu inscripción.
              </p>

              <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-8 mb-10 text-left">
                <h3 className="font-bold text-text mb-4 text-lg">Próximos pasos:</h3>
                <ul className="space-y-4">
                  {[
                    'Busca el correo de Laburauto',
                    'Haz click en "Firmar Contrato"',
                    'Revisa y firma digitalmente',
                    'Vuelve aquí para ver tu dashboard'
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-text font-medium">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-5 max-w-sm mx-auto">
                <button
                  onClick={() => refreshSession()}
                  className="w-full py-4 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 active:scale-[0.98]"
                >
                  Ya lo firmé
                </button>
                <button
                  onClick={handleResendEmail}
                  disabled={resendMutation.isPending}
                  className="text-brand-500 hover:text-brand-600 font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resendMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Reenviar email'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

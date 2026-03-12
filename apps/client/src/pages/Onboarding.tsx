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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const stepNum = i + 1;
              return (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${step >= stepNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                      }`}
                  >
                    {stepNum}
                  </div>
                  {stepNum < totalSteps && (
                    <div
                      className={`h-1 w-32 mx-2 ${step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>KYC Verification</span>
            <span>Choose Role</span>
            <span>{selectedRole === 'publisher' ? 'Enrollment Contract' : 'Documents'}</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 1 && (
            <form onSubmit={handleSubmitKYC(handleKYCSubmit)} className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex p-3 bg-blue-100 rounded-full mb-4">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">KYC Verification</h2>
                <p className="text-gray-500 mt-2">
                  We need to verify your identity to ensure a safe platform for everyone.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    {...registerKYC('fullName')}
                    disabled
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-gray-100 cursor-not-allowed text-gray-500"
                    placeholder="John Doe"
                  />
                  {kycErrors.fullName && (
                    <p className="text-red-500 text-sm mt-1">{kycErrors.fullName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Number (DNI/Passport)
                  </label>
                  <input
                    {...registerKYC('idNumber')}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="12.345.678"
                  />
                  {kycErrors.idNumber && (
                    <p className="text-red-500 text-sm mt-1">{kycErrors.idNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    {...registerKYC('dateOfBirth')}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                  {kycErrors.dateOfBirth && (
                    <p className="text-red-500 text-sm mt-1">{kycErrors.dateOfBirth.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    {...registerKYC('address')}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Street Address, City"
                  />
                  {kycErrors.address && (
                    <p className="text-red-500 text-sm mt-1">{kycErrors.address.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    {...registerKYC('phone')}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="+54 11 1234-5678"
                  />
                  {kycErrors.phone && (
                    <p className="text-red-500 text-sm mt-1">{kycErrors.phone.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight size={20} />
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Choose Your Role</h2>
                <p className="text-gray-500 mt-2">
                  Are you looking to publish cars or rent them?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IconRadioCard
                  id="publisher"
                  value="publisher"
                  label="Publisher"
                  description="List your vehicles for rent"
                  icon={Car}
                  selected={selectedRole === 'publisher'}
                  onChange={(value) => setSelectedRole(value as 'publisher' | 'driver')}
                />
                <IconRadioCard
                  id="driver"
                  value="driver"
                  label="Driver"
                  description="Rent vehicles to drive"
                  icon={UserIcon}
                  selected={selectedRole === 'driver'}
                  onChange={(value) => setSelectedRole(value as 'publisher' | 'driver')}
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => selectedRole && handleRoleSelect(selectedRole)}
                  disabled={!selectedRole || completeMutation.isPending}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {completeMutation.isPending ? 'Processing...' : 'Continue'}
                  <ChevronRight size={20} />
                </button>
              </div>

              {completeMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {completeMutation.error?.message || 'Failed to complete onboarding'}
                </div>
              )}
            </div>
          )}

          {step === 3 && selectedRole === 'driver' && (
            <form onSubmit={handleSubmitDocs(handleDocumentsSubmit)} className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex p-3 bg-green-100 rounded-full mb-4">
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Renter Verification</h2>
                <p className="text-gray-500 mt-2">
                  Please provide at least one ride-share rating and your criminal background check.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Ride-Share Ratings (at least one required)
                  </h3>
                  <p className="text-sm text-blue-700 mb-4">Upload screenshots showing your ratings</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['uberRating', 'cabifyRating', 'indriveRating', 'didiRating'].map((field) => {
                      const fieldValue = watchDocs(field as keyof RenterDocumentsData);
                      const isUploaded = !!fieldValue;

                      return (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 mb-1 capitalize flex items-center gap-2">
                            {field.replace('Rating', '')} Rating
                            {isUploaded && (
                              <span className="text-green-600 text-xs flex items-center gap-1">
                                ✓ Uploaded
                              </span>
                            )}
                          </label>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleFileUpload(e, field as keyof RenterDocumentsData)}
                            className={`w-full px-3 py-2 border rounded-lg text-sm ${isUploaded
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-300'
                              }`}
                          />
                          <input type="hidden" {...registerDocs(field as any)} />
                        </div>
                      );
                    })}
                  </div>

                  {docsErrors.uberRating && (
                    <p className="text-red-500 text-sm mt-3">
                      {docsErrors.uberRating.message}
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    DNI Photo (Required)
                  </h3>
                  <p className="text-sm text-yellow-700 mb-3">Upload a photo of your DNI (National ID)</p>

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileUpload(e, 'dniPhoto')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input type="hidden" {...registerDocs('dniPhoto')} />
                  {docsErrors.dniPhoto && (
                    <p className="text-red-500 text-sm mt-1">{docsErrors.dniPhoto.message}</p>
                  )}
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Criminal Background Check (Required)
                  </h3>
                  <p className="text-sm text-red-700 mb-3">Recent "Antecedentes Penales" document</p>

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileUpload(e, 'criminalBackground')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input type="hidden" {...registerDocs('criminalBackground')} />
                  {docsErrors.criminalBackground && (
                    <p className="text-red-500 text-sm mt-1">
                      {docsErrors.criminalBackground.message}
                    </p>
                  )}
                </div>

                {docsErrors.root && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {docsErrors.root.message}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending || submitDocsMutation.isPending || completeMutation.isPending}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(uploadMutation.isPending || submitDocsMutation.isPending || completeMutation.isPending)
                    ? 'Processing...'
                    : 'Complete'}
                  <ChevronRight size={20} />
                </button>
              </div>

              {submitDocsMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {submitDocsMutation.error?.message || 'Failed to submit documents'}
                </div>
              )}
            </form>
          )}

          {step === 3 && selectedRole === 'publisher' && (
            <div className="text-center py-12">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-brand-500 mb-4" />
                <p className="text-text-muted font-medium">Preparando tu contrato de inscripción...</p>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-blue-100 rounded-full mb-6">
                <Mail className="h-12 w-12 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Check Your Email</h2>
              <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
                We've sent you a contract to sign. Please check your inbox and follow the link to complete your enrollment.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 text-left">
                <h3 className="font-semibold text-yellow-800 mb-2">Next Steps:</h3>
                <ul className="list-disc list-inside text-yellow-700 space-y-2">
                  <li>Open the email from Laburauto</li>
                  <li>Click the "Sign Contract" link</li>
                  <li>Review and sign the document</li>
                  <li>Return here to access your dashboard</li>
                </ul>
              </div>

              <div className="flex flex-col gap-4 justify-center">
                <button
                  onClick={() => refreshSession()}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  I've Signed It
                </button>
                <button
                  onClick={handleResendEmail}
                  disabled={resendMutation.isPending}
                  className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendMutation.isPending ? 'Sending...' : 'Resend Email'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

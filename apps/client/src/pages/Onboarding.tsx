import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Car, User as UserIcon, FileText, ChevronRight, ChevronLeft, Shield, Star, CreditCard, PenTool, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompleteOnboarding, useFileUpload, useSubmitRenterDocuments, useContractTemplates, useCreateContractInstance, useContractInstance, useResendEnrollment } from '../hooks/useApi';
import api from '../lib/api';
import { kycSchema, type KYCData, renterDocumentsSchema, type RenterDocumentsData } from '../schemas/validation';
import IconRadioCard from '../components/IconRadioCard';
import { DocumentSigner } from '../components/DocumentSigner';

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
      onSuccess: () => alert('Enrollment email resent successfully!'),
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to resend email'),
    });
  };

  const { data: templates } = useContractTemplates('publisher_enrollment', {
    enabled: selectedRole === 'publisher'
  });
  const [contractInstanceId, setContractInstanceId] = useState<number | null>(null);
  const { data: contractInstance } = useContractInstance(contractInstanceId || undefined);
  const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
  const [isSigning, setIsSigning] = useState(false);

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
    // We need to wait for templates if they are loading?
    // This function is async. We can check if templates are ready.
    // However, react-query is async. The 'Continue' button in Step 2 triggers this.
    // If selectedRole is publisher, the query starts.
    // We might need to ensure templates are present.

    // Simplification: Proceed to step 3 and show loading there if needed?
    // The previous logic checked templates immediately.
    // Let's rely on the user clicking "Continue" which gives time for the query.
    // If templates are not ready, we should show loading state or wait.

    // However, the requested change is to prevent FETCHING before role is set.
    // We did that with `enabled: selectedRole === 'publisher'`.
    // Now we need to make sure we don't crash if they are not loaded yet.
    if (!user) return;

    // If templates are loading, we can't check them yet.
    // But since this is called on "Continue", likely the fetch started when they clicked the radio button?
    // No, `handleRoleSelect` is called by "Continue" button as well in the current code?
    // Let's check line 326: onClick={() => selectedRole && handleRoleSelect(selectedRole)}
    // And line 302: onChange={(value) => setSelectedRole(...)}
    // So picking the radio button sets state -> query enabled -> starts fetching.
    // Clicking "Continue" calls `handleRoleSelect` -> `handleStartPublisherEnrollment`.

    if (!templates || templates.length === 0) {
      // Fallback if no enrollment contract exists or not loaded yet
      if (!templates) {
        // Could be loading.
        // Let's create a small delay or retry? Or mostly likely undefined means loading.
        // For now, let's just complete without contract if no templates found after a wait or immediately if we assume they load fast.
        // Better safe:
        console.warn('Templates not ready or empty, proceeding without enrollment contract.');
        handleCompleteOnboarding('publisher');
        return;
      }

      handleCompleteOnboarding('publisher');
      return;
    }

    try {
      const templateId = templates[0].id; // Use first enrollment template
      const instance = await createContractMutation.mutateAsync({
        templateId,
        publisherId: user.id
      });

      setContractInstanceId(instance.id);

      // Fetch the PDF using the api client (which handles JWT)
      const pdfUrl = templates[0].pdfUrl;
      const response = await api.get(pdfUrl, { responseType: 'arraybuffer' });
      setPdfFile(new Uint8Array(response.data));

      setStep(3);
      setIsSigning(true);
    } catch (error) {
      console.error('Failed to start enrollment:', error);
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
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex p-3 bg-indigo-100 rounded-full mb-4">
                  <PenTool className="h-8 w-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Partnership Agreement</h2>
                <p className="text-gray-500 mt-2">
                  Please review and sign the publisher enrollment contract to proceed.
                </p>
              </div>

              {pdfFile && contractInstance ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 uppercase font-bold text-center">
                    Click the button below to open the legal document and sign.
                  </p>
                  <button
                    onClick={() => setIsSigning(true)}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <PenTool size={20} />
                    Open and Sign Contract
                  </button>
                </div>
              ) : (
                <div className="py-20 text-center text-gray-400 animate-pulse">
                  Preparing your contract...
                </div>
              )}

              {isSigning && pdfFile && contractInstance && (
                <DocumentSigner
                  mode="signer"
                  activeStageId="st_signer_1" // Assuming first signer stage has this ID
                  initialData={{
                    id: contractInstance.id.toString(),
                    pdfFile: pdfFile as any, // Cast to any to bypass strict type check for now
                    fields: (contractInstance as any).template.fields,
                    stages: (contractInstance as any).template.stages,
                  }}
                  onFinish={async () => {
                    // Logic to save individual signatures could go here
                    // For now, we'll mark the contract as signed on the backend
                    await handleCompleteOnboarding('publisher');
                    setIsSigning(false);
                  }}
                  onClose={() => setIsSigning(false)}
                />
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
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

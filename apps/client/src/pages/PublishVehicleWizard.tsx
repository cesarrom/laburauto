import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  Camera, FileText, Car as CarIcon, Clock, MapPin, Key,
  ChevronRight, ChevronLeft, Upload, X
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import Autocomplete from '../components/Autocomplete';
import MapPicker from '../components/MapPicker';
import api from '../lib/api';

// Hooks & Schemas
import { useFileUpload, useCreateVehicle } from '../hooks/useApi';
import {
  vehicleInfoSchema, shiftSchema, locationSchema, accessSchema, publisherDocumentsSchema,
  type VehicleInfoData, type ShiftData, type LocationData, type AccessData, type PublisherDocumentsData
} from '../schemas/validation';

type AddressSearchResult = {
  address?: string;
  title?: string;
  description?: string;
  place_id?: string;
  lat: number;
  lng: number;
};

type VehicleVersionOption = {
  id: string;
  version: string;
};

const STEPS = [
  { id: 1, name: 'Photos', icon: Camera },
  { id: 2, name: 'Documents', icon: FileText },
  { id: 3, name: 'Vehicle Info', icon: CarIcon },
  { id: 4, name: 'Shifts & Price', icon: Clock },
  { id: 5, name: 'Location', icon: MapPin },
  { id: 6, name: 'Access', icon: Key },
];

export default function PublishVehicleWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);

  // Mutations
  const uploadMutation = useFileUpload();
  const createVehicleMutation = useCreateVehicle();

  // Step Data State
  const [photos, setPhotos] = useState<string[]>([]);
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [addressSearchResults, setAddressSearchResults] = useState<AddressSearchResult[]>([]);

  // Forms
  const vehicleForm = useForm<VehicleInfoData>({
    resolver: zodResolver(vehicleInfoSchema)
  });

  const shiftForm = useForm<ShiftData>({
    resolver: zodResolver(shiftSchema)
  });

  const locationForm = useForm<LocationData>({
    resolver: zodResolver(locationSchema)
  });

  const accessForm = useForm<AccessData>({
    resolver: zodResolver(accessSchema)
  });

  const docsForm = useForm<PublisherDocumentsData>({
    resolver: zodResolver(publisherDocumentsSchema)
  });

  // --- Handlers ---

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const urls = await uploadMutation.mutateAsync({ files: Array.from(files), type: 'vehicle' });
      setPhotos(prev => [...prev, ...urls]);

      // Auto-prefill AI (Silent)
      if (photos.length === 0 && urls.length > 0) {
        inferVehicleInfoSilently(urls[0]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof PublisherDocumentsData) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const urls = await uploadMutation.mutateAsync({ files: Array.from(files), type: 'kyc' });
      if (urls.length > 0) {
        docsForm.setValue(field, urls[0], { shouldValidate: true });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const inferVehicleInfoSilently = async (imageUrl: string) => {
    try {
      // Direct call or use mutation
      const response = await api.post('/ai/infer-vehicle', { imageUrl });
      if (response.data.success) {
        const { make, model, year, color } = response.data.data;

        // Use setValue from React Hook Form
        if (make) vehicleForm.setValue('brand', make);
        if (model) vehicleForm.setValue('model', model);
        if (year) vehicleForm.setValue('year', year);
        if (color) vehicleForm.setValue('color', color);

        console.log('AI Prefill Success');
      }
    } catch {
      console.log('AI Silent fail');
    }
  };

  const addShift = (data: ShiftData) => {
    setShifts([...shifts, data]);
    shiftForm.reset();
  };

  const handleFinalSubmit = async (accessData: AccessData) => {
    if (!user) return;

    // Combine all data
    const fullData = {
      publisherId: user.id,
      photos,
      ...docsForm.getValues(),
      ...vehicleForm.getValues(), // Now contains vehicleModelId and color
      idleLat: locationForm.getValues('lat'),
      idleLong: locationForm.getValues('long'),
      idleAddress: locationForm.getValues('address'),
      accessInstructions: accessData.instructions,
      paymentInstructions: accessData.paymentInstructions,
      shifts: shifts,
    };

    try {
      await createVehicleMutation.mutateAsync(fullData);

      // If we had a batch create shifts endpoint, we'd call it here
      // For now, redirect
      navigate('/my-vehicles');
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish vehicle');
    }
  };

  // --- Step Navigation Validation ---
  const nextStep = async () => {
    if (currentStep === 1) {
      if (photos.length === 0) return alert('Please upload at least one photo');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const valid = await docsForm.trigger();
      if (valid) setCurrentStep(3);
    } else if (currentStep === 3) {
      // Trigger validation
      const valid = await vehicleForm.trigger();
      if (valid) setCurrentStep(4);
    } else if (currentStep === 4) {
      if (shifts.length === 0) return alert('Please add at least one shift');
      setCurrentStep(5);
    } else if (currentStep === 5) {
      const valid = await locationForm.trigger();
      if (valid) setCurrentStep(6);
    }
  };

  // Common Input Classes
  const inputClasses = "w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent text-gray-900 bg-white placeholder-gray-400";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 text-text">
      <header className="rounded-[32px] border border-border bg-surface p-6 md:p-10 shadow-soft space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Laburauto · Publicación guiada</p>
        <h1 className="text-3xl md:text-4xl font-display">Publicá un vehículo con toda la documentación respaldada.</h1>
        <p className="text-text-muted max-w-3xl">Fotos, cláusulas, turnos y logística se cargan en un flujo único para que el contrato quede listo sin correos ni planillas externas.</p>
      </header>

      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${isActive ? 'bg-brand-500 text-white scale-110 border-brand-400' :
                      isCompleted ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-surface-muted text-text-muted border-border'
                      }`}
                  >
                    <Icon size={20} />
                  </div>
                  <span className={`text-xs mt-2 uppercase tracking-[0.3em] ${isActive ? 'font-semibold text-brand-500' : 'text-text-muted'}`}>
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 rounded-full ${isCompleted ? 'bg-emerald-400' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[32px] border border-border bg-surface shadow-soft p-6 md:p-10">
        {/* STEP 1: PHOTOS */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <Camera className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Upload Photos</h2>
              <p className="text-gray-500 mt-2">Add photos of your vehicle from multiple angles</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <img src={photo} alt="Vehicle" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                {uploadMutation.isPending && uploading ? (
                  <span className="text-blue-600 text-sm">Uploading...</span>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Upload Photo</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: DOCUMENTS */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Upload Documents</h2>
              <p className="text-gray-500 mt-2">Required legal documentation for your vehicle</p>
            </div>

            <div className="space-y-4">
              {/* Registration */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Certificate (Cédula)</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      id="registration-upload"
                      onChange={(e) => handleDocumentUpload(e, 'registrationCertificate')}
                    />
                    <label
                      htmlFor="registration-upload"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition cursor-pointer ${docsForm.watch('registrationCertificate') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500'}`}
                    >
                      <Upload size={18} />
                      {docsForm.watch('registrationCertificate') ? 'Cédula Uploaded ✓' : 'Upload Cédula'}
                    </label>
                  </div>
                  {docsForm.watch('registrationCertificate') && (
                    <button onClick={() => docsForm.setValue('registrationCertificate', '')} className="text-red-500"><X size={20} /></button>
                  )}
                </div>
                {docsForm.formState.errors.registrationCertificate && (
                  <p className="text-red-500 text-xs mt-1">{docsForm.formState.errors.registrationCertificate.message}</p>
                )}
              </div>

              {/* Insurance */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Proof of Insurance</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      id="insurance-upload"
                      onChange={(e) => handleDocumentUpload(e, 'proofOfInsurance')}
                    />
                    <label
                      htmlFor="insurance-upload"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition cursor-pointer ${docsForm.watch('proofOfInsurance') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500'}`}
                    >
                      <Upload size={18} />
                      {docsForm.watch('proofOfInsurance') ? 'Insurance Uploaded ✓' : 'Upload Insurance'}
                    </label>
                  </div>
                  {docsForm.watch('proofOfInsurance') && (
                    <button onClick={() => docsForm.setValue('proofOfInsurance', '')} className="text-red-500"><X size={20} /></button>
                  )}
                </div>
                {docsForm.formState.errors.proofOfInsurance && (
                  <p className="text-red-500 text-xs mt-1">{docsForm.formState.errors.proofOfInsurance.message}</p>
                )}
              </div>

              {/* VTV */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Technical Inspection (VTV)</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      id="vtv-upload"
                      onChange={(e) => handleDocumentUpload(e, 'technicalInspection')}
                    />
                    <label
                      htmlFor="vtv-upload"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition cursor-pointer ${docsForm.watch('technicalInspection') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500'}`}
                    >
                      <Upload size={18} />
                      {docsForm.watch('technicalInspection') ? 'VTV Uploaded ✓' : 'Upload VTV'}
                    </label>
                  </div>
                  {docsForm.watch('technicalInspection') && (
                    <button onClick={() => docsForm.setValue('technicalInspection', '')} className="text-red-500"><X size={20} /></button>
                  )}
                </div>
                {docsForm.formState.errors.technicalInspection && (
                  <p className="text-red-500 text-xs mt-1">{docsForm.formState.errors.technicalInspection.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: VEHICLE INFO */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <CarIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Vehicle Details</h2>
              <p className="text-gray-500 mt-2">Complete your vehicle information</p>
            </div>

            {/* Note: We use FormProvider if Autocomplete needed context, but passing setValue is simpler */}
            <div className="space-y-4">
              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  {...vehicleForm.register('year', { valueAsNumber: true })}
                  className={inputClasses}
                  placeholder="2024"
                />
                {vehicleForm.formState.errors.year && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.year.message}</p>}
              </div>

              {/* Brand */}
              <Autocomplete
                label="Brand (Marca)"
                value={vehicleForm.watch('brand') || ''}
                onChange={(val) => {
                  vehicleForm.setValue('brand', val, { shouldValidate: true });
                  // Clear downstream
                  vehicleForm.setValue('model', '');
                  vehicleForm.setValue('version', '');
                  vehicleForm.setValue('vehicleModelId', '');
                }}
                fetchOptions={async (query) => {
                  const res = await api.get(`/vehicles-db/brands?q=${query}`);
                  return res.data.results;
                }}
                placeholder="Fiat, Ford, Toyota..."
                required
              />
              {vehicleForm.formState.errors.brand && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.brand.message}</p>}

              {/* Model */}
              <Autocomplete
                label="Model (Modelo)"
                value={vehicleForm.watch('model') || ''}
                onChange={(val) => {
                  vehicleForm.setValue('model', val, { shouldValidate: true });
                  // Clear downstream
                  vehicleForm.setValue('version', '');
                  vehicleForm.setValue('vehicleModelId', '');
                }}
                fetchOptions={async (query) => {
                  const brand = vehicleForm.watch('brand');
                  if (!brand) return [];
                  const res = await api.get(`/vehicles-db/models?brand=${encodeURIComponent(brand)}&q=${query}`);
                  return res.data.results;
                }}
                placeholder={vehicleForm.watch('brand') ? "Cronos, Ranger, etc." : "Select Brand first"}
                required
              />
              {vehicleForm.formState.errors.model && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.model.message}</p>}

              {/* Version */}
              <Autocomplete
                label="Version (Versión)"
                value={vehicleForm.watch('version') || ''}
                onChange={async (val) => {
                  vehicleForm.setValue('version', val, { shouldValidate: true });
                  // We need to fetch the ID for this version. 
                  // Since autocomplete just returns strings, we can re-fetch or assume uniqueness.
                  // Ideally we'd have the ID from the selection event, but Autocomplete component implementation is string-based.
                  // Let's do a quick lookup query or rely on a slight refactor. 
                  // For now, we'll fetch precise match to get ID.
                  if (val) {
                    try {
                      const brand = vehicleForm.watch('brand');
                      const model = vehicleForm.watch('model');
                      const res = await api.get<{ results: VehicleVersionOption[] }>(`/vehicles-db/versions?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&q=${encodeURIComponent(val)}`);
                      const match = res.data.results.find((v) => v.version === val);
                      if (match) {
                        vehicleForm.setValue('vehicleModelId', match.id);
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  }
                }}
                fetchOptions={async (query) => {
                  const brand = vehicleForm.watch('brand');
                  const model = vehicleForm.watch('model');
                  if (!brand || !model) return [];
                  const res = await api.get<{ results: VehicleVersionOption[] }>(`/vehicles-db/versions?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&q=${query}`);
                  return res.data.results.map((r) => r.version);
                }}
                placeholder={vehicleForm.watch('model') ? "Drive 1.3, XLT, etc." : "Select Model first"}
                required
              />
              {vehicleForm.formState.errors.version && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.version.message}</p>}

              {/* Patente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patente (License Plate)</label>
                <input
                  {...vehicleForm.register('plate')}
                  className={`${inputClasses} uppercase`}
                  placeholder="AB123CD"
                  maxLength={7}
                />
                <p className="text-xs text-gray-500 mt-1">Argentina format: AB123CD or ABC123</p>
                {vehicleForm.formState.errors.plate && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.plate.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Mileage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mileage (km)</label>
                  <input
                    type="number"
                    {...vehicleForm.register('mileage', { valueAsNumber: true })}
                    className={inputClasses}
                    placeholder="50000"
                  />
                  {vehicleForm.formState.errors.mileage && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.mileage.message}</p>}
                </div>
                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    {...vehicleForm.register('color')}
                    className={inputClasses}
                    placeholder="Silver"
                  />
                  {vehicleForm.formState.errors.color && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.color.message}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...vehicleForm.register('description')}
                  rows={4}
                  className={inputClasses}
                  placeholder="Describe condition, features..."
                />
                {vehicleForm.formState.errors.description && <p className="text-red-500 text-sm mt-1">{vehicleForm.formState.errors.description.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SHIFTS */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <Clock className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Shifts & Price</h2>
              <p className="text-gray-500 mt-2">Set availability and pricing</p>
            </div>

            {shifts.length > 0 && (
              <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900">Added Shifts:</h3>
                {shifts.map((s, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-gray-100">
                    <div>
                      <span className="font-bold text-gray-800 capitalize">{s.type}</span>
                      <span className="text-gray-500 text-sm ml-2">({s.startTime} - {s.endTime})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-600 font-bold">${s.price}</span>
                      <button onClick={() => setShifts(shifts.filter((_, idx) => idx !== i))} className="text-red-500"><X size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={shiftForm.handleSubmit(addShift)} className="p-4 bg-blue-50 rounded-lg space-y-4 border border-blue-100">
              <h3 className="font-semibold text-blue-900">Add New Shift</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift Type</label>
                <select {...shiftForm.register('type')} className={inputClasses}>
                  <option value="morning">Morning</option>
                  <option value="night">Night</option>
                  <option value="custom">Custom</option>
                </select>
                {shiftForm.formState.errors.type && <p className="text-red-500 text-sm mt-1">{shiftForm.formState.errors.type.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input type="time" {...shiftForm.register('startTime')} className={inputClasses} />
                  {shiftForm.formState.errors.startTime && <p className="text-red-500 text-sm mt-1">{shiftForm.formState.errors.startTime.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input type="time" {...shiftForm.register('endTime')} className={inputClasses} />
                  {shiftForm.formState.errors.endTime && <p className="text-red-500 text-sm mt-1">{shiftForm.formState.errors.endTime.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (ARS)</label>
                <input type="number" {...shiftForm.register('price', { valueAsNumber: true })} className={inputClasses} placeholder="5000" />
                {shiftForm.formState.errors.price && <p className="text-red-500 text-sm mt-1">{shiftForm.formState.errors.price.message}</p>}
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
                Add Shift
              </button>
            </form>
          </div>
        )}

        {/* STEP 5: LOCATION */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="text-center">
              <MapPin className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Idle Location</h2>
              <p className="text-gray-500 mt-2">Where is the vehicle parked?</p>
            </div>

            {/* Address Search */}
            <Autocomplete
              label="Search Address"
              value={locationForm.watch('address')}
              onChange={(val) => {
                locationForm.setValue('address', val);
                const match = addressSearchResults.find(r => (r.address ?? r.title) === val);
                if (match) {
                  locationForm.setValue('lat', match.lat);
                  locationForm.setValue('long', match.lng);
                }
              }}
              fetchOptions={async (q) => {
                const res = await api.get<{ results: AddressSearchResult[] }>(`/navigation/search?text=${q}`);
                const results = res.data.results ?? [];
                setAddressSearchResults(results);
                return results.map((r) => r.address || r.title || '').filter(Boolean);
              }}
              placeholder="Type address..."
            />
            {locationForm.formState.errors.address && <p className="text-red-500 text-sm mt-1">{locationForm.formState.errors.address.message}</p>}

            {/* Map */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pin Location on Map</label>
              <MapPicker
                lat={locationForm.watch('lat')}
                lng={locationForm.watch('long')}
                onLocationSelect={async (lat, lng) => {
                  locationForm.setValue('lat', lat);
                  locationForm.setValue('long', lng);
                  // Reverse geocode
                  try {
                    const res = await api.get(`/navigation/reverse?lat=${lat}&lng=${lng}`);
                    if (res.data.address) locationForm.setValue('address', res.data.address);
                  } catch (e) { console.error(e); }
                }}
                className="h-64 md:h-80 w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lat</label>
                <input type="number" step="any" readOnly {...locationForm.register('lat', { valueAsNumber: true })} className={inputClasses + " bg-gray-100"} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Long</label>
                <input type="number" step="any" readOnly {...locationForm.register('long', { valueAsNumber: true })} className={inputClasses + " bg-gray-100"} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: ACCESS */}
        {currentStep === 6 && (
          <form id="access-form" onSubmit={accessForm.handleSubmit(handleFinalSubmit)} className="space-y-6">
            <div className="text-center">
              <Key className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Final Details</h2>
              <p className="text-gray-500 mt-2">Payment and access information</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Payment Instructions <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-blue-700 mb-2">
                How should renters pay you? (e.g., bank transfer, cash, etc.)
              </p>
              <textarea
                {...accessForm.register('paymentInstructions', {
                  required: 'Payment instructions are required',
                  minLength: { value: 20, message: 'Please provide detailed payment instructions' }
                })}
                rows={4}
                className={inputClasses}
                placeholder="Transfer to: CBU 1234567890... or Cash on pickup..."
              />
              {accessForm.formState.errors.paymentInstructions && (
                <p className="text-red-500 text-sm mt-1">{accessForm.formState.errors.paymentInstructions.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Instructions</label>
              <p className="text-xs text-gray-500 mb-2">
                How to get the keys or access the vehicle
              </p>
              <textarea
                {...accessForm.register('instructions')}
                rows={6}
                className={inputClasses}
                placeholder="The keys are with the security guard at the building entrance..."
              />
              {accessForm.formState.errors.instructions && <p className="text-red-500 text-sm mt-1">{accessForm.formState.errors.instructions.message}</p>}
            </div>
          </form>
        )}

        {/* NAV BUTTONS */}
        <div className="flex gap-4 mt-8">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep(curr => curr - 1)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <ChevronLeft size={20} /> Back
            </button>
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={20} />
            </button>
          ) : (
            <button
              type="submit"
              form="access-form"
              disabled={createVehicleMutation.isPending}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createVehicleMutation.isPending ? 'Publishing...' : 'Publish Vehicle'}
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

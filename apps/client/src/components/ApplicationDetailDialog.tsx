import { X, User, FileText, Calendar, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface ApplicationDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  application: any;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export default function ApplicationDetailDialog({
  isOpen,
  onClose,
  application,
  onApprove,
  onReject,
  isApproving,
  isRejecting
}: ApplicationDetailDialogProps) {
  if (!isOpen || !application) return null;

  const dates = application.selectedDates as string[];
  const shiftIds = application.selectedShiftIds as number[];
  const renterDocs = application.renterDocuments;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Application Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Renter Profile */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{application.renter?.name}</h3>
                  <p className="text-sm text-gray-600">{application.renter?.email}</p>
                </div>
              </div>

              {/* KYC Data */}
              {application.renter?.kycData && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{JSON.parse(application.renter.kycData).phoneNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">ID Number:</span>
                    <p className="font-medium">{JSON.parse(application.renter.kycData).idNumber}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Address:</span>
                    <p className="font-medium">{JSON.parse(application.renter.kycData).address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Rental Request */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Rental Request</h3>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{dates.length} day{dates.length > 1 ? 's' : ''}:</span>
                  <span>{format(new Date(dates[0]), 'MMM d')} - {format(new Date(dates[dates.length - 1]), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>{shiftIds.length} total shift{shiftIds.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-lg font-bold text-green-600">${application.totalPrice?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Verification Documents */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Verification Documents
              </h3>

              {!renterDocs ? (
                <p className="text-sm text-gray-500 italic">No documents available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DNI Photo */}
                  {renterDocs.dniPhoto && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">DNI (National ID)</p>
                      <a
                        href={renterDocs.dniPhoto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        📄 View Document →
                      </a>
                    </div>
                  )}

                  {/* Ride-share ratings */}
                  {renterDocs.uberRating && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Uber Rating</p>
                      <a
                        href={renterDocs.uberRating}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        ⭐ View Rating →
                      </a>
                    </div>
                  )}

                  {renterDocs.cabifyRating && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Cabify Rating</p>
                      <a
                        href={renterDocs.cabifyRating}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        ⭐ View Rating →
                      </a>
                    </div>
                  )}

                  {renterDocs.indriveRating && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">inDrive Rating</p>
                      <a
                        href={renterDocs.indriveRating}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        ⭐ View Rating →
                      </a>
                    </div>
                  )}

                  {renterDocs.didiRating && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">DiDi Rating</p>
                      <a
                        href={renterDocs.didiRating}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        ⭐ View Rating →
                      </a>
                    </div>
                  )}

                  {/* Criminal Background */}
                  {renterDocs.criminalBackground && (
                    <div className="border rounded-lg p-3 md:col-span-2 bg-green-50 border-green-200">
                      <p className="text-sm font-semibold text-green-900 mb-2">🛡️ Criminal Background Check</p>
                      <a
                        href={renterDocs.criminalBackground}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-700 hover:underline flex items-center gap-1"
                      >
                        📋 View Document →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Close
            </button>
            <button
              onClick={onReject}
              disabled={isRejecting || isApproving}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
            >
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </button>
            <button
              onClick={onApprove}
              disabled={isApproving || isRejecting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {isApproving ? 'Approving...' : 'Approve Application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

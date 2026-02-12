import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, isAfter, startOfDay, addMonths } from 'date-fns';
import { Clock, DollarSign, Calendar as CalendarIcon, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

interface DateShiftSelectorProps {
  vehicleId: number;
  shifts: Array<{ id: number; type: string; startTime: string; endTime: string; price: number }>;
  onComplete: (selectedDates: string[], selectedShiftIds: number[], totalPrice: number) => void;
}

// Map of date -> array of shift IDs
type ShiftAssignments = Record<string, number[]>;

export default function DateShiftSelector({ vehicleId, shifts, onComplete }: DateShiftSelectorProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignments>({});
  const [takenSlots, setTakenSlots] = useState<Record<string, number[]>>({}); // dateStr -> takenShiftIds

  // Fetch availability when component mounts (next 3 months)
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const today = new Date();
        const endDate = addMonths(today, 3);

        const startStr = today.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const res = await api.get(`/applications/vehicles/${vehicleId}/calendar-availability?start=${startStr}&end=${endStr}`);
        setTakenSlots(res.data);
      } catch (error) {
        console.error('Failed to fetch availability', error);
      }
    };

    if (vehicleId) {
      fetchAvailability();
    }
  }, [vehicleId]);

  const isDateFullyBooked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const taken = takenSlots[dateStr] || [];
    // If all shifts are taken, date is fully booked
    return shifts.length > 0 && shifts.every(shift => taken.includes(shift.id));
  };

  const isShiftTaken = (dateStr: string, shiftId: number) => {
    const taken = takenSlots[dateStr] || [];
    return taken.includes(shiftId);
  };

  const handleDayClick = (date: Date) => {
    const today = startOfDay(new Date());
    if (!isAfter(date, today)) {
      return; // Don't allow past dates
    }

    if (isDateFullyBooked(date)) {
      return; // Can't select fully booked dates
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const existingIndex = selectedDates.findIndex(d => format(d, 'yyyy-MM-dd') === dateStr);

    if (existingIndex >= 0) {
      // Remove date
      setSelectedDates(selectedDates.filter((_, i) => i !== existingIndex));
      const newAssignments = { ...shiftAssignments };
      delete newAssignments[dateStr];
      setShiftAssignments(newAssignments);
    } else {
      // Add date
      setSelectedDates([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const toggleShift = (dateStr: string, shiftId: number) => {
    if (isShiftTaken(dateStr, shiftId)) return; // Can't select taken shift

    const current = shiftAssignments[dateStr] || [];
    const newAssignments = { ...shiftAssignments };

    if (current.includes(shiftId)) {
      // Remove shift
      newAssignments[dateStr] = current.filter(id => id !== shiftId);
      if (newAssignments[dateStr].length === 0) {
        delete newAssignments[dateStr];
      }
    } else {
      // Add shift
      newAssignments[dateStr] = [...current, shiftId];
    }

    setShiftAssignments(newAssignments);
  };

  const toggleShiftForAll = (shiftId: number) => {
    // Check current state across all dates
    let allHaveIt = true;

    selectedDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const current = shiftAssignments[dateStr] || [];
      if (current.includes(shiftId)) {
        // Do nothing, we only care if everyone has it to determine 'allHaveIt'
      } else {
        allHaveIt = false;
      }
    });

    const newAssignments: ShiftAssignments = { ...shiftAssignments };

    if (allHaveIt) {
      // All have it, remove from all
      selectedDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const current = shiftAssignments[dateStr] || [];
        newAssignments[dateStr] = current.filter(id => id !== shiftId);
        if (newAssignments[dateStr].length === 0) {
          delete newAssignments[dateStr];
        }
      });
    } else {
      // None or some have it, add to all
      selectedDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const current = shiftAssignments[dateStr] || [];
        if (!current.includes(shiftId)) {
          newAssignments[dateStr] = [...current, shiftId];
        } else {
          newAssignments[dateStr] = current;
        }
      });
    }

    setShiftAssignments(newAssignments);
  };

  const getShiftState = (shiftId: number): 'none' | 'all' | 'mixed' => {
    if (selectedDates.length === 0) return 'none';

    let countWithShift = 0;
    selectedDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const current = shiftAssignments[dateStr] || [];
      if (current.includes(shiftId)) {
        countWithShift++;
      }
    });

    if (countWithShift === 0) return 'none';
    if (countWithShift === selectedDates.length) return 'all';
    return 'mixed';
  };

  const calculateTotal = () => {
    let total = 0;
    const shiftPriceMap = new Map(shifts.map(s => [s.id, s.price]));

    Object.values(shiftAssignments).forEach(shiftIds => {
      shiftIds.forEach(shiftId => {
        total += shiftPriceMap.get(shiftId) || 0;
      });
    });

    return total;
  };

  const getDateStrings = () => selectedDates.map(d => format(d, 'yyyy-MM-dd'));

  // Check if all dates have at least one shift
  const isComplete = selectedDates.length > 0 &&
    selectedDates.every(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return shiftAssignments[dateStr] && shiftAssignments[dateStr].length > 0;
    });

  const handleSubmit = () => {
    if (!isComplete) return;

    const dateStrings = getDateStrings();
    // Flatten: for each date, we'll have one or more shifts
    // We need to duplicate dates for multiple shifts
    const finalDates: string[] = [];
    const finalShiftIds: number[] = [];

    dateStrings.forEach(dateStr => {
      const dateShifts = shiftAssignments[dateStr] || [];
      dateShifts.forEach(shiftId => {
        finalDates.push(dateStr);
        finalShiftIds.push(shiftId);
      });
    });

    onComplete(finalDates, finalShiftIds, calculateTotal());
  };

  const getTotalSlots = () => {
    return Object.values(shiftAssignments).reduce((sum, shifts) => sum + shifts.length, 0);
  };

  const modifiers = {
    selected: selectedDates,
    disabled: (date: Date) => isDateFullyBooked(date) || !isAfter(date, startOfDay(new Date())),
  };

  const modifiersStyles = {
    selected: {
      backgroundColor: '#2563eb',
      color: 'white',
      fontWeight: 'bold',
    },
    disabled: {
      color: '#d1d5db',
      cursor: 'not-allowed',
      textDecoration: 'line-through'
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full mb-2">
          <Sparkles size={16} />
          <span className="text-sm font-semibold">Select Your Rental Dates</span>
        </div>
        <p className="text-gray-600 text-sm">Click dates to select, click again to remove</p>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-2 text-white">
            <CalendarIcon size={20} />
            <h3 className="font-semibold">Pick Your Dates</h3>
          </div>
        </div>

        <div className="p-6 flex justify-center">
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onDayClick={handleDayClick}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            disabled={{ before: new Date() }}
            className="!font-sans"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-semibold text-gray-900",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent hover:bg-blue-100 p-0 rounded transition-colors",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-gray-500 rounded-md w-9 font-medium text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal hover:bg-gray-100 rounded transition-colors aria-selected:opacity-100",
              day_selected: "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white",
              day_disabled: "text-gray-300 opacity-50 cursor-not-allowed hover:bg-transparent",
            }}
          />
        </div>

        {selectedDates.length > 0 && (
          <div className="px-6 pb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Selected: {selectedDates.length} day{selectedDates.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedDates.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const shiftsCount = (shiftAssignments[dateStr] || []).length;
                  return (
                    <span
                      key={dateStr}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-white text-blue-900 rounded-full text-xs font-medium border border-blue-300"
                    >
                      {format(date, 'MMM d')}
                      {shiftsCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-green-600 text-white rounded-full text-xs font-bold">
                          {shiftsCount}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shift Assignment */}
      {selectedDates.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
            <div className="flex items-center gap-2 text-white">
              <Clock size={20} />
              <h3 className="font-semibold">Choose Shifts</h3>
            </div>
            <p className="text-purple-100 text-sm mt-1">You can select multiple shifts per day</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Quick assign */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-5 border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-purple-600" />
                <p className="text-sm font-semibold text-purple-900">Quick Toggle All Dates</p>
              </div>
              <p className="text-xs text-purple-700 mb-3">Click to toggle each shift type for all dates</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {shifts.map(shift => {
                  const state = getShiftState(shift.id);

                  return (
                    <button
                      key={shift.id}
                      onClick={() => toggleShiftForAll(shift.id)}
                      className={`group relative px-4 py-4 border-2 rounded-xl hover:shadow-md transition-all text-left ${state === 'all'
                        ? 'bg-green-50 border-green-500'
                        : state === 'mixed'
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-white border-purple-300 hover:border-purple-500'
                        }`}
                    >
                      {/* State indicator icon */}
                      {state !== 'none' && (
                        <div className="absolute -top-2 -right-2">
                          {state === 'all' ? (
                            <CheckCircle2 className="h-7 w-7 text-green-600 bg-white rounded-full" />
                          ) : (
                            <div className="h-7 w-7 bg-white rounded-full flex items-center justify-center border-2 border-yellow-500">
                              <div className="h-3 w-3 bg-yellow-500 rounded-sm" />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <span className={`font-bold capitalize text-sm ${state === 'all' ? 'text-green-900' : state === 'mixed' ? 'text-yellow-900' : 'text-gray-900'
                          }`}>
                          {shift.type}
                        </span>
                        <span className={`text-xs ${state === 'all' ? 'text-green-700' : state === 'mixed' ? 'text-yellow-700' : 'text-gray-600'
                          }`}>
                          {shift.startTime} - {shift.endTime}
                        </span>
                        <span className={`text-lg font-bold mt-1 ${state === 'all' ? 'text-green-600' : state === 'mixed' ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                          ${shift.price}
                        </span>
                      </div>

                      <div className={`absolute inset-0 rounded-xl transition-opacity ${state === 'none'
                        ? 'bg-purple-600 opacity-0 group-hover:opacity-5'
                        : state === 'all'
                          ? 'bg-green-600 opacity-0'
                          : 'bg-yellow-600 opacity-0'
                        }`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual assignment */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Customize Per Date:</p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedDates.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const selectedForDate = shiftAssignments[dateStr] || [];

                  return (
                    <div key={dateStr} className="border-2 border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                      <p className="text-sm font-bold text-gray-900 mb-3 flex items-center justify-between">
                        <span>📅 {format(date, 'EEEE, MMMM d, yyyy')}</span>
                        {selectedForDate.length > 0 && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                            {selectedForDate.length} shift{selectedForDate.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {shifts.map(shift => {
                          const isSelected = selectedForDate.includes(shift.id);
                          return (
                            <button
                              key={shift.id}
                              onClick={() => toggleShift(dateStr, shift.id)}
                              className={`relative px-3 py-3 border-2 rounded-lg transition-all text-sm ${isSelected
                                ? 'border-green-600 bg-green-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                                }`}
                            >
                              {isSelected && (
                                <div className="absolute -top-2 -right-2">
                                  <CheckCircle2 className="h-6 w-6 text-green-600 bg-white rounded-full" />
                                </div>
                              )}
                              <div className="flex flex-col gap-1">
                                <span className={`font-semibold capitalize ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>
                                  {shift.type}
                                </span>
                                <span className={`text-xs ${isSelected ? 'text-green-700' : 'text-gray-500'}`}>
                                  {shift.startTime} - {shift.endTime}
                                </span>
                                <span className={`text-sm font-bold ${isSelected ? 'text-green-600' : 'text-gray-600'}`}>
                                  ${shift.price}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Total & Submit */}
      {selectedDates.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg border-2 border-green-300 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Cost</p>
                  <p className="text-4xl font-bold text-gray-900">
                    ${calculateTotal().toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">{selectedDates.length} day{selectedDates.length > 1 ? 's' : ''}</p>
                <p className="text-sm font-semibold text-green-700">
                  {getTotalSlots()} slot{getTotalSlots() !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isComplete}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-600 disabled:hover:to-emerald-600 shadow-lg hover:shadow-xl disabled:shadow-lg transform hover:scale-[1.02] disabled:transform-none"
            >
              {isComplete
                ? '🚀 Submit Application'
                : '⏳ Select at least one shift for each date'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

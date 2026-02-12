import { Clock, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { Shift } from '../../hooks/useVehicles';

interface ShiftSelectorProps {
  shifts: Shift[];
  selectedShiftId: number | null;
  onSelect: (id: number) => void;
}

export default function ShiftSelector({ shifts, selectedShiftId, onSelect }: ShiftSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mb-8">
      {shifts.map(shift => {
        const isSelected = selectedShiftId === shift.id;

        return (
          <div
            key={shift.id}
            onClick={() => onSelect(shift.id)}
            className={clsx(
              "cursor-pointer p-4 rounded-xl border-2 transition relative flex flex-col justify-between select-none",
              isSelected
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 bg-white"
            )}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold capitalize text-lg flex items-center gap-2">
                <Clock className={clsx("w-4 h-4", isSelected ? "text-blue-600" : "text-gray-400")} />
                {shift.type}
              </span>
              <span className="text-xl font-bold text-blue-600">${shift.price}</span>
            </div>
            <div className="text-gray-600 text-sm">
              {shift.startTime} - {shift.endTime}
            </div>
            {isSelected && (
              <div className="absolute top-4 right-4 text-blue-600">
                <CheckCircle className="w-5 h-5 fill-blue-100" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

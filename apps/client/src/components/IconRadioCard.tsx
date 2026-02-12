import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface IconRadioCardProps {
  id: string;
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  onChange: (value: string) => void;
}

export default function IconRadioCard({
  id,
  value,
  label,
  description,
  icon: Icon,
  selected,
  onChange,
}: IconRadioCardProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={clsx(
        'relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 hover:scale-105',
        selected
          ? 'border-blue-600 bg-blue-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      )}
    >
      <input
        type="radio"
        id={id}
        name="role"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <div
        className={clsx(
          'p-4 rounded-full transition-colors',
          selected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        )}
      >
        <Icon size={40} strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-lg text-gray-900">{label}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </button>
  );
}

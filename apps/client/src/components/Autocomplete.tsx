import { useState, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  fetchOptions: (query: string) => Promise<string[]>;
  placeholder?: string;
  label?: string;
  required?: boolean;
}


export default function Autocomplete({
  value,
  onChange,
  fetchOptions,
  placeholder = 'Type to search...',
  label,
  required = false,
}: AutocompleteProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const debouncedFetch = useDebouncedCallback(async (inputValue: string) => {
    setLoading(true);
    try {
      const results = await fetchOptions(inputValue);
      setOptions(results);
      setIsOpen(true);
    } catch (error) {
      console.error('Autocomplete fetch error:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, 750);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue);

    if (inputValue.length >= 1) {
      debouncedFetch(inputValue);
    } else {
      setOptions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => value && setIsOpen(true)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
      />

      {isOpen && options.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
          ) : (
            options.map((option, index) => (
              <div
                key={index}
                onClick={() => handleSelect(option)}
                className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
              >
                {option}
              </div>
            ))
          )}
        </div>
      )}

      {isOpen && !loading && options.length === 0 && value && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Typeable location field (combobox).
 * - Suggestions: LOCATIONS + extras + values from past bookings (DB)
 * - User can type any custom place
 * - On blur → Title Case (e.g. "dha phase 5" → "Dha Phase 5")
 * Backend stores plain string on Booking.pickupLocation / returnLocation
 */
import { useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { LOCATIONS } from '@/constants';

const toTitleCase = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (word) => {
      if (word.length <= 4 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

export default function FormLocationCombobox({
  name,
  label,
  extras = [],
  suggestions = [],
  required = false,
  disabled = false,
  placeholder = 'Type or select location…',
}) {
  const { control, formState } = useFormContext();
  const error = formState.errors?.[name]?.message;

  const options = useMemo(() => {
    const set = new Set();
    const list = [];
    for (const item of [...extras, ...LOCATIONS, ...suggestions]) {
      const v = String(item || '').trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (set.has(key)) continue;
      set.add(key);
      list.push(v);
    }
    return list;
  }, [extras, suggestions]);

  const listId = `${name}-location-list`;

  return (
    <div>
      {label && (
        <label className="label" htmlFor={name}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <>
            <input
              {...field}
              id={name}
              list={listId}
              className="input"
              disabled={disabled}
              placeholder={placeholder}
              autoComplete="off"
              onBlur={(e) => {
                field.onChange(toTitleCase(e.target.value));
                field.onBlur();
              }}
              onChange={(e) => field.onChange(e.target.value)}
            />
            <datalist id={listId}>
              {options.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </>
        )}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
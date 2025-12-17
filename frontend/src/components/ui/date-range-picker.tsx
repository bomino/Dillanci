import * as React from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, startOfYear, isValid } from 'date-fns';
import { Calendar, X, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePreset {
  label: string;
  value: DateRange;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const defaultPresets: DateRangePreset[] = [
  {
    label: 'Today',
    value: { from: new Date(), to: new Date() },
  },
  {
    label: 'Last 7 days',
    value: { from: subDays(new Date(), 6), to: new Date() },
  },
  {
    label: 'Last 30 days',
    value: { from: subDays(new Date(), 29), to: new Date() },
  },
  {
    label: 'This month',
    value: { from: startOfMonth(new Date()), to: new Date() },
  },
  {
    label: 'Last month',
    value: {
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    },
  },
  {
    label: 'This quarter',
    value: { from: startOfQuarter(new Date()), to: new Date() },
  },
  {
    label: 'Year to date',
    value: { from: startOfYear(new Date()), to: new Date() },
  },
];

function formatDateRange(range: DateRange): string {
  if (!range.from && !range.to) {
    return '';
  }
  if (range.from && range.to) {
    if (range.from.getTime() === range.to.getTime()) {
      return format(range.from, 'MMM d, yyyy');
    }
    return `${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`;
  }
  if (range.from) {
    return `${format(range.from, 'MMM d, yyyy')} - ...`;
  }
  return `... - ${format(range.to!, 'MMM d, yyyy')}`;
}

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  return isValid(parsed) ? parsed : null;
}

export function DateRangePicker({
  value,
  onChange,
  presets = defaultPresets,
  placeholder = 'Select date range',
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [fromInput, setFromInput] = React.useState('');
  const [toInput, setToInput] = React.useState('');

  // Sync inputs with value
  React.useEffect(() => {
    setFromInput(value.from ? format(value.from, 'yyyy-MM-dd') : '');
    setToInput(value.to ? format(value.to, 'yyyy-MM-dd') : '');
  }, [value.from, value.to]);

  const handlePresetClick = (preset: DateRangePreset) => {
    onChange(preset.value);
    setIsOpen(false);
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromInput(e.target.value);
    const parsed = parseDate(e.target.value);
    if (parsed || e.target.value === '') {
      onChange({ ...value, from: parsed });
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToInput(e.target.value);
    const parsed = parseDate(e.target.value);
    if (parsed || e.target.value === '') {
      onChange({ ...value, to: parsed });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  const displayValue = formatDateRange(value);
  const hasValue = value.from || value.to;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'min-w-[200px] justify-between font-normal',
            !hasValue && 'text-neutral-500',
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="truncate">
              {displayValue || placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasValue && (
              <X
                className="h-4 w-4 text-neutral-400 hover:text-neutral-600"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Presets */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Quick Select
            </p>
            <div className="flex flex-wrap gap-1">
              {presets.map((preset, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200" />

          {/* Custom Range */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Custom Range
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="date"
                  value={fromInput}
                  onChange={handleFromChange}
                  className="h-8 text-sm"
                  placeholder="Start date"
                />
              </div>
              <span className="text-neutral-400">to</span>
              <div className="flex-1">
                <Input
                  type="date"
                  value={toInput}
                  onChange={handleToChange}
                  className="h-8 text-sm"
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ from: null, to: null });
                setIsOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangePicker;

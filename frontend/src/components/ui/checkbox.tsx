import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, indeterminate, id, ...props }, ref) => {
  const generatedId = React.useId();
  const checkboxId = id || generatedId;

  // Handle indeterminate state
  const checked = indeterminate ? 'indeterminate' : props.checked;

  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <CheckboxPrimitive.Root
          ref={ref}
          id={checkboxId}
          className={cn(
            'peer h-4 w-4 shrink-0 rounded border shadow-sm',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[state=checked]:bg-primary-700 data-[state=checked]:border-primary-700 data-[state=checked]:text-white',
            'data-[state=indeterminate]:bg-primary-700 data-[state=indeterminate]:border-primary-700 data-[state=indeterminate]:text-white',
            error
              ? 'border-error focus-visible:ring-error/20'
              : 'border-neutral-300 focus-visible:ring-primary-500/20',
            className
          )}
          checked={checked}
          {...props}
        >
          <CheckboxPrimitive.Indicator
            className={cn('flex items-center justify-center text-current')}
          >
            {indeterminate ? (
              <Minus className="h-3 w-3" strokeWidth={3} />
            ) : (
              <Check className="h-3 w-3" strokeWidth={3} />
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
      </div>
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label
              htmlFor={checkboxId}
              className={cn(
                'text-sm font-medium leading-none cursor-pointer',
                'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                error ? 'text-error' : 'text-neutral-900'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-sm text-neutral-500 mt-1">{description}</p>
          )}
          {error && <p className="text-sm text-error mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
});

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

// Checkbox Group for multiple related checkboxes
interface CheckboxGroupProps {
  label?: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function CheckboxGroup({
  label,
  description,
  error,
  children,
  className,
}: CheckboxGroupProps) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      {label && (
        <legend
          className={cn(
            'text-sm font-medium',
            error ? 'text-error' : 'text-neutral-900'
          )}
        >
          {label}
        </legend>
      )}
      {description && (
        <p className="text-sm text-neutral-500">{description}</p>
      )}
      <div className="space-y-2">{children}</div>
      {error && <p className="text-sm text-error">{error}</p>}
    </fieldset>
  );
}

export { Checkbox, CheckboxGroup };

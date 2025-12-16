import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  showCharCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, showCharCount, maxLength, ...props }, ref) => {
    const [charCount, setCharCount] = React.useState(
      props.value?.toString().length || props.defaultValue?.toString().length || 0
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      props.onChange?.(e);
    };

    return (
      <div className="relative">
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border bg-white px-3 py-2',
            'text-sm text-neutral-900 placeholder:text-neutral-400',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50',
            'resize-y',
            error
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500/20',
            className
          )}
          ref={ref}
          maxLength={maxLength}
          onChange={handleChange}
          {...props}
        />
        {showCharCount && maxLength && (
          <div
            className={cn(
              'absolute bottom-2 right-2 text-xs',
              charCount >= maxLength ? 'text-error' : 'text-neutral-400'
            )}
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };

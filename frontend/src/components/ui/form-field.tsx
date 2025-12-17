import * as React from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type ControllerRenderProps,
  type FieldError,
} from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FormFieldContextValue {
  id: string;
  name: string;
  error?: FieldError;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

function useFormField() {
  const context = React.useContext(FormFieldContext);
  if (!context) {
    throw new Error('useFormField must be used within a FormField');
  }
  return context;
}

// Form Field wrapper for react-hook-form
interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
    error?: FieldError;
  }) => React.ReactNode;
}

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  const id = React.useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FormFieldContext.Provider value={{ id, name, error }}>
          <div className={cn('space-y-2', className)}>
            {label && (
              <Label htmlFor={id} required={required} className={error ? 'text-error' : undefined}>
                {label}
              </Label>
            )}
            {description && (
              <p className="text-sm text-neutral-500">{description}</p>
            )}
            {children({ field, error })}
            {error && (
              <p className="text-sm text-error" role="alert">
                {error.message}
              </p>
            )}
          </div>
        </FormFieldContext.Provider>
      )}
    />
  );
}

// Simple field wrapper without react-hook-form (for uncontrolled forms)
interface FieldWrapperProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}

function FieldWrapper({
  label,
  description,
  error,
  required,
  className,
  children,
  htmlFor,
}: FieldWrapperProps) {
  const id = React.useId();
  const fieldId = htmlFor || id;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={fieldId} required={required} className={error ? 'text-error' : undefined}>
          {label}
        </Label>
      )}
      {description && (
        <p className="text-sm text-neutral-500">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Form component wrapper
interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

function Form({ children, className, ...props }: FormProps) {
  return (
    <form className={cn('space-y-6', className)} {...props}>
      {children}
    </form>
  );
}

// Form section for grouping fields
interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div>
          {title && (
            <h3 className="text-lg font-medium text-neutral-900">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-neutral-500 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// Form actions (buttons at the bottom)
interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

function FormActions({
  children,
  className,
  align = 'right',
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex gap-3 pt-4 border-t border-neutral-200',
        {
          'justify-start': align === 'left',
          'justify-center': align === 'center',
          'justify-end': align === 'right',
          'justify-between': align === 'between',
        },
        className
      )}
    >
      {children}
    </div>
  );
}

export {
  FormField,
  FieldWrapper,
  Form,
  FormSection,
  FormActions,
  useFormField,
};

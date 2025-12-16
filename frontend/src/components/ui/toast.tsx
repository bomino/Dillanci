import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster component - renders toast notifications
 * Uses Sonner with Sahel design system styling
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'group flex items-center gap-3 w-full rounded-lg border p-4 shadow-lg',
          title: 'text-sm font-medium',
          description: 'text-sm opacity-90',
          actionButton:
            'bg-primary-700 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-primary-800 transition-colors',
          cancelButton:
            'bg-neutral-100 text-neutral-700 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-neutral-200 transition-colors',
          success:
            'bg-green-50 border-green-200 text-green-900 [&>svg]:text-green-600',
          error: 'bg-red-50 border-red-200 text-red-900 [&>svg]:text-red-600',
          warning:
            'bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600',
          info: 'bg-blue-50 border-blue-200 text-blue-900 [&>svg]:text-blue-600',
          default:
            'bg-white border-neutral-200 text-neutral-900 [&>svg]:text-neutral-600',
        },
      }}
      {...props}
    />
  );
}

// Re-export toast function for convenience
export { Toaster, toast };

// Helper functions for common toast types
export const showToast = {
  success: (message: string, options?: Parameters<typeof toast.success>[1]) =>
    toast.success(message, options),

  error: (message: string, options?: Parameters<typeof toast.error>[1]) =>
    toast.error(message, options),

  warning: (message: string, options?: Parameters<typeof toast.warning>[1]) =>
    toast.warning(message, options),

  info: (message: string, options?: Parameters<typeof toast.info>[1]) =>
    toast.info(message, options),

  loading: (message: string, options?: Parameters<typeof toast.loading>[1]) =>
    toast.loading(message, options),

  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => toast.promise(promise, options),

  dismiss: (toastId?: string | number) => toast.dismiss(toastId),

  custom: (message: string, options?: Parameters<typeof toast>[1]) =>
    toast(message, options),
};

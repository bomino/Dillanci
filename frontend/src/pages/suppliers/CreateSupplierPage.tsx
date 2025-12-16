import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SupplierForm } from '@/components/suppliers';
import { useCreateSupplier } from '@/lib/api/suppliers';
import type { SupplierPayload } from '@/lib/api/suppliers';

export default function CreateSupplierPage() {
  const navigate = useNavigate();
  const createMutation = useCreateSupplier();

  const handleSubmit = async (data: SupplierPayload) => {
    try {
      const supplier = await createMutation.mutateAsync(data);
      // Navigate to the new supplier's detail page
      navigate(`/suppliers/${supplier.id}`, {
        state: { message: 'Supplier created successfully' },
      });
    } catch (error) {
      // Error handling is done by React Query
      console.error('Failed to create supplier:', error);
    }
  };

  const handleCancel = () => {
    navigate('/suppliers');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/suppliers')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Suppliers
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
          <Building2 className="h-6 w-6 text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Add New Supplier
          </h1>
          <p className="text-neutral-500">
            Enter the supplier details below
          </p>
        </div>
      </div>

      {/* Error Message */}
      {createMutation.isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">
            Failed to create supplier. Please check your input and try again.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="max-w-4xl">
        <SupplierForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RequisitionForm } from '@/components/requisitions';
import { useCreateRequisition } from '@/lib/api/requisitions';
import type { RequisitionPayload } from '@/lib/api/requisitions';

export default function CreateRequisitionPage() {
  const navigate = useNavigate();
  const createMutation = useCreateRequisition();

  const handleSubmit = async (data: RequisitionPayload) => {
    try {
      const requisition = await createMutation.mutateAsync(data);
      // Navigate to the new requisition's detail page
      navigate(`/requisitions/${requisition.id}`, {
        state: { message: 'Requisition created successfully' },
      });
    } catch (error) {
      // Error handling is done by React Query
      console.error('Failed to create requisition:', error);
    }
  };

  const handleCancel = () => {
    navigate('/requisitions');
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
          onClick={() => navigate('/requisitions')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requisitions
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
          <FileText className="h-6 w-6 text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Requisition
          </h1>
          <p className="text-neutral-500">
            Create a purchase request for goods or services
          </p>
        </div>
      </div>

      {/* Error Message */}
      {createMutation.isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">
            Failed to create requisition. Please check your input and try again.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="max-w-4xl">
        <RequisitionForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

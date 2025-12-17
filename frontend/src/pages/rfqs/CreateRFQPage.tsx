import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RFQForm } from '@/components/rfqs';

import { useCreateRFQ, type RFQPayload } from '@/lib/api/rfqs';

export default function CreateRFQPage() {
  const navigate = useNavigate();
  const createMutation = useCreateRFQ();

  const handleSubmit = async (data: RFQPayload) => {
    try {
      const newRFQ = await createMutation.mutateAsync(data);
      navigate(`/rfqs/${newRFQ.id}`, {
        state: { message: 'RFQ created successfully' },
      });
    } catch (error) {
      console.error('Failed to create RFQ:', error);
    }
  };

  const handleCancel = () => {
    navigate('/rfqs');
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
          onClick={() => navigate('/rfqs')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RFQs
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
          <FileQuestion className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Request for Quotation
          </h1>
          <p className="text-neutral-500">
            Create an RFQ to request quotes from suppliers
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <RFQForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

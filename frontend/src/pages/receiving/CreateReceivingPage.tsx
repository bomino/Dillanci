import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ReceivingForm } from '@/components/receiving';

import { useCreateGoodsReceipt, type GoodsReceiptPayload } from '@/lib/api/receiving';

export default function CreateReceivingPage() {
  const navigate = useNavigate();
  const createMutation = useCreateGoodsReceipt();

  const handleSubmit = async (data: GoodsReceiptPayload) => {
    try {
      const newGR = await createMutation.mutateAsync(data);
      navigate(`/receiving/${newGR.id}`, {
        state: { message: 'Goods receipt created successfully' },
      });
    } catch (error) {
      console.error('Failed to create goods receipt:', error);
    }
  };

  const handleCancel = () => {
    navigate('/receiving');
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
          onClick={() => navigate('/receiving')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Receiving
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">
          <Package className="h-6 w-6 text-cyan-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Goods Receipt
          </h1>
          <p className="text-neutral-500">
            Record delivery of items from a Purchase Order
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <ReceivingForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

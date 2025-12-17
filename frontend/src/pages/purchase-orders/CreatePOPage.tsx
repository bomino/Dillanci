import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { POForm } from '@/components/purchase-orders';

import { useCreatePurchaseOrder, type POPayload } from '@/lib/api/purchase-orders';

export default function CreatePOPage() {
  const navigate = useNavigate();
  const createMutation = useCreatePurchaseOrder();

  const handleSubmit = async (data: POPayload) => {
    try {
      const newPO = await createMutation.mutateAsync(data);
      navigate(`/purchase-orders/${newPO.id}`, {
        state: { message: 'Purchase Order created successfully' },
      });
    } catch (error) {
      console.error('Failed to create Purchase Order:', error);
    }
  };

  const handleCancel = () => {
    navigate('/purchase-orders');
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
          onClick={() => navigate('/purchase-orders')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
          <ShoppingCart className="h-6 w-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Purchase Order
          </h1>
          <p className="text-neutral-500">
            Create a purchase order to order goods from a supplier
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <POForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/invoices';

import { useCreateInvoice, type InvoicePayload } from '@/lib/api/invoices';

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const createMutation = useCreateInvoice();

  const handleSubmit = async (data: InvoicePayload) => {
    try {
      const newInvoice = await createMutation.mutateAsync(data);
      navigate(`/invoices/${newInvoice.id}`, {
        state: { message: 'Invoice created successfully' },
      });
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  const handleCancel = () => {
    navigate('/invoices');
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
          onClick={() => navigate('/invoices')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
          <FileText className="h-6 w-6 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Invoice
          </h1>
          <p className="text-neutral-500">
            Create a new invoice from a Purchase Order
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <InvoiceForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

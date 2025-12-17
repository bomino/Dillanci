import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ContractForm } from '@/components/contracts';

import { useCreateContract, type ContractPayload } from '@/lib/api/contracts';

export default function CreateContractPage() {
  const navigate = useNavigate();
  const createMutation = useCreateContract();

  const handleSubmit = async (data: ContractPayload) => {
    try {
      const newContract = await createMutation.mutateAsync(data);
      navigate(`/contracts/${newContract.id}`, {
        state: { message: 'Contract created successfully' },
      });
    } catch (error) {
      console.error('Failed to create contract:', error);
    }
  };

  const handleCancel = () => {
    navigate('/contracts');
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
          onClick={() => navigate('/contracts')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contracts
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
          <FileText className="h-6 w-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Contract
          </h1>
          <p className="text-neutral-500">
            Create a new supplier contract or agreement
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <ContractForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

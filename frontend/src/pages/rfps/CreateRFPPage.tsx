import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RFPForm } from '@/components/rfps';

import { useCreateRFP, type RFPPayload } from '@/lib/api/rfps';

export default function CreateRFPPage() {
  const navigate = useNavigate();
  const createMutation = useCreateRFP();

  const handleSubmit = async (data: RFPPayload) => {
    try {
      const newRFP = await createMutation.mutateAsync(data);
      navigate(`/rfps/${newRFP.id}`, {
        state: { message: 'RFP created successfully' },
      });
    } catch (error) {
      console.error('Failed to create RFP:', error);
    }
  };

  const handleCancel = () => {
    navigate('/rfps');
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
          onClick={() => navigate('/rfps')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RFPs
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
          <FileText className="h-6 w-6 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            New Request for Proposal
          </h1>
          <p className="text-neutral-500">
            Create an RFP for complex procurement needs
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <RFPForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          mode="create"
        />
      </div>
    </motion.div>
  );
}

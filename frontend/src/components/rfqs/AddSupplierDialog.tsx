import { useState, useMemo } from 'react';
import { Search, Loader2, Building2, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAddInvitation } from '@/lib/api/rfqs';
import type { Supplier } from '@/types';

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfqId: string;
  availableSuppliers: Supplier[];
}

const supplierTypeLabels: Record<string, string> = {
  MANUFACTURER: 'Manufacturer',
  DISTRIBUTOR: 'Distributor',
  SERVICE_PROVIDER: 'Service Provider',
  CONTRACTOR: 'Contractor',
  OTHER: 'Other',
};

export function AddSupplierDialog({
  open,
  onOpenChange,
  rfqId,
  availableSuppliers,
}: AddSupplierDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addInvitationMutation = useAddInvitation();

  // Filter suppliers by search query
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return availableSuppliers;

    const query = searchQuery.toLowerCase();
    return availableSuppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        supplier.city?.toLowerCase().includes(query) ||
        supplier.state?.toLowerCase().includes(query)
    );
  }, [availableSuppliers, searchQuery]);

  const handleToggleSupplier = (supplierId: string) => {
    setSelectedSuppliers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(supplierId)) {
        newSet.delete(supplierId);
      } else {
        newSet.add(supplierId);
      }
      return newSet;
    });
  };

  const handleAddSuppliers = async () => {
    if (selectedSuppliers.size === 0) return;

    setIsSubmitting(true);
    const supplierIds = Array.from(selectedSuppliers);
    let successCount = 0;
    let failCount = 0;

    for (const supplierId of supplierIds) {
      try {
        await addInvitationMutation.mutateAsync({ rfqId, supplierId });
        successCount++;
      } catch (error) {
        console.error(`Failed to invite supplier ${supplierId}:`, error);
        failCount++;
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast.success(
        `${successCount} supplier${successCount > 1 ? 's' : ''} invited`,
        {
          description:
            successCount === 1
              ? 'Invitation has been sent'
              : 'Invitations have been sent',
        }
      );
    }

    if (failCount > 0) {
      toast.error(`Failed to invite ${failCount} supplier${failCount > 1 ? 's' : ''}`);
    }

    // Reset and close
    setSelectedSuppliers(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedSuppliers(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Suppliers to RFQ</DialogTitle>
          <DialogDescription>
            Select suppliers to invite to this RFQ. They will be notified and able to
            submit bids.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Supplier List */}
        <ScrollArea className="h-[300px] border rounded-lg">
          {filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Building2 className="h-12 w-12 text-neutral-300 mb-3" />
              {availableSuppliers.length === 0 ? (
                <>
                  <p className="text-neutral-500 font-medium">No suppliers available</p>
                  <p className="text-sm text-neutral-400 mt-1">
                    All approved suppliers have already been invited
                  </p>
                </>
              ) : (
                <>
                  <p className="text-neutral-500 font-medium">No suppliers found</p>
                  <p className="text-sm text-neutral-400 mt-1">
                    Try a different search term
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredSuppliers.map((supplier) => {
                const isSelected = selectedSuppliers.has(supplier.id);
                return (
                  <label
                    key={supplier.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-50 transition-colors ${
                      isSelected ? 'bg-primary-50' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSupplier(supplier.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900 truncate">
                          {supplier.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {supplierTypeLabels[supplier.supplier_type] || supplier.supplier_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {[supplier.city, supplier.state].filter(Boolean).join(', ') ||
                          'Location not specified'}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Selection count */}
        {selectedSuppliers.size > 0 && (
          <p className="text-sm text-neutral-600">
            {selectedSuppliers.size} supplier{selectedSuppliers.size > 1 ? 's' : ''} selected
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddSuppliers}
            disabled={selectedSuppliers.size === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>Add {selectedSuppliers.size || ''} Supplier{selectedSuppliers.size !== 1 ? 's' : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddSupplierDialog;

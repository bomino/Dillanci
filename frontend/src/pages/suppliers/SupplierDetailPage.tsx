import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SupplierForm } from '@/components/suppliers';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';

import {
  useSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useApproveSupplier,
  useSuspendSupplier,
  supplierTypeConfig,
} from '@/lib/api/suppliers';
import type { SupplierPayload } from '@/lib/api/suppliers';
import { formatDateTime } from '@/lib/utils';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: supplier, isLoading, isError } = useSupplier(id);
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const approveMutation = useApproveSupplier();
  const suspendMutation = useSuspendSupplier();

  // Check for success message from create page
  const successMessage = location.state?.message;

  const handleUpdate = async (data: SupplierPayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, payload: data });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update supplier:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/suppliers', {
        state: { message: 'Supplier deleted successfully' },
      });
    } catch (error) {
      console.error('Failed to delete supplier:', error);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve supplier:', error);
    }
  };

  const handleSuspend = async () => {
    if (!id) return;
    try {
      await suspendMutation.mutateAsync({ id });
    } catch (error) {
      console.error('Failed to suspend supplier:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-neutral-900">
          Supplier Not Found
        </h2>
        <p className="text-neutral-500 mt-1">
          The supplier you're looking for doesn't exist or has been deleted.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate('/suppliers')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Suppliers
        </Button>
      </div>
    );
  }

  // Edit mode
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel Edit
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Building2 className="h-6 w-6 text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit Supplier
            </h1>
            <p className="text-neutral-500">{supplier.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <SupplierForm
            initialData={supplier}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={updateMutation.isPending}
            mode="edit"
          />
        </div>
      </motion.div>
    );
  }

  // View mode
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {successMessage}
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/suppliers')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {supplier.status === 'PENDING_REVIEW' && (
            <Button
              variant="outline"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {supplier.status === 'APPROVED' && (
            <Button
              variant="outline"
              onClick={handleSuspend}
              disabled={suspendMutation.isPending}
              className="text-orange-700 border-orange-200 hover:bg-orange-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Supplier Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-100">
          <Building2 className="h-8 w-8 text-primary-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900">
              {supplier.name}
            </h1>
            <StatusBadge status={supplier.status} />
          </div>
          <p className="text-neutral-500 mt-1">
            {supplier.number} &middot;{' '}
            {supplierTypeConfig[supplier.supplier_type]?.label || supplier.supplier_type}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-neutral-500">Supplier Name</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-1">
                    {supplier.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Legal Name</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-1">
                    {supplier.legal_name || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Tax ID</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-1">
                    {supplier.tax_id || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">D-U-N-S Number</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-1">
                    {supplier.duns_number || '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-neutral-400" />
                <CardTitle>Address</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {supplier.address_line_1 ? (
                <address className="not-italic text-sm text-neutral-700">
                  {supplier.address_line_1}
                  {supplier.address_line_2 && (
                    <>
                      <br />
                      {supplier.address_line_2}
                    </>
                  )}
                  <br />
                  {[supplier.city, supplier.state, supplier.postal_code]
                    .filter(Boolean)
                    .join(', ')}
                  {supplier.country && supplier.country !== 'USA' && (
                    <>
                      <br />
                      {supplier.country}
                    </>
                  )}
                </address>
              ) : (
                <p className="text-sm text-neutral-400">No address on file</p>
              )}
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection objectType="supplier" objectId={supplier.id} />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsSection
                objectType="supplier"
                objectId={supplier.id}
                acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {supplier.email && (
                <a
                  href={`mailto:${supplier.email}`}
                  className="flex items-center gap-3 text-sm text-neutral-700 hover:text-primary-700 transition-colors"
                >
                  <Mail className="h-4 w-4 text-neutral-400" />
                  {supplier.email}
                </a>
              )}
              {supplier.phone && (
                <a
                  href={`tel:${supplier.phone}`}
                  className="flex items-center gap-3 text-sm text-neutral-700 hover:text-primary-700 transition-colors"
                >
                  <Phone className="h-4 w-4 text-neutral-400" />
                  {supplier.phone}
                </a>
              )}
              {supplier.website && (
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-neutral-700 hover:text-primary-700 transition-colors"
                >
                  <Globe className="h-4 w-4 text-neutral-400" />
                  {supplier.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {!supplier.email && !supplier.phone && !supplier.website && (
                <p className="text-sm text-neutral-400">No contact information</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-neutral-400" />
                <CardTitle>Payment Terms</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-neutral-500">Terms</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-0.5">
                    {supplier.payment_terms}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Currency</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-0.5">
                    {supplier.currency}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <CardTitle>Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-neutral-500">Created</dt>
                  <dd className="text-sm text-neutral-900 mt-0.5">
                    {formatDateTime(supplier.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Last Updated</dt>
                  <dd className="text-sm text-neutral-900 mt-0.5">
                    {formatDateTime(supplier.updated_at)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-neutral-900">
                {supplier.name}
              </span>
              ? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

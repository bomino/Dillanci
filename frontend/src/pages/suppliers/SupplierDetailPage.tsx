import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  UserPlus,
  Users,
  Clock,
  Send,
  Loader2,
  Copy,
  ExternalLink,
  Settings,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SupplierForm, ManagePortalAccessDialog } from '@/components/suppliers';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';

import {
  useSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useApproveSupplier,
  useSuspendSupplier,
  useInviteToPortal,
  usePortalInvitations,
  usePortalUsers,
  supplierTypeConfig,
} from '@/lib/api/suppliers';
import type { SupplierPayload, PortalInvitation, PortalUser } from '@/lib/api/suppliers';
import { formatDateTime } from '@/lib/utils';

// Zod schema for invite form
const inviteFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  personal_message: z.string().optional(),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [managePortalDialogOpen, setManagePortalDialogOpen] = useState(false);
  const [lastInvitation, setLastInvitation] = useState<PortalInvitation | null>(null);

  const { data: supplier, isLoading, isError } = useSupplier(id);
  const { data: portalInvitations, isLoading: invitationsLoading } = usePortalInvitations(id);
  const { data: portalUsers, isLoading: usersLoading } = usePortalUsers(id);
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const approveMutation = useApproveSupplier();
  const suspendMutation = useSuspendSupplier();
  const inviteMutation = useInviteToPortal();

  // Form for invite dialog
  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: '',
      personal_message: '',
    },
  });

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

  const handleInviteToPortal = async (data: InviteFormValues) => {
    if (!id) return;
    try {
      const invitation = await inviteMutation.mutateAsync({
        supplierId: id,
        payload: data,
      });
      setLastInvitation(invitation);
      inviteForm.reset();
      toast.success('Invitation Sent', {
        description: `Portal invitation sent to ${data.email}`,
      });
    } catch (error: any) {
      const message = error?.response?.data?.email?.[0] ||
                      error?.response?.data?.error ||
                      'Failed to send invitation';
      toast.error('Error', {
        description: message,
      });
    }
  };

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied', {
      description: 'Registration link copied to clipboard',
    });
  };

  const closeInviteDialog = () => {
    setInviteDialogOpen(false);
    setLastInvitation(null);
    inviteForm.reset();
  };

  // Get status badge variant for invitation status
  const getInvitationStatusVariant = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'ACCEPTED': return 'success';
      case 'EXPIRED': return 'neutral';
      case 'REVOKED': return 'danger';
      default: return 'neutral';
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
            <>
              <Button
                variant="outline"
                onClick={() => setInviteDialogOpen(true)}
                className="text-primary-700 border-primary-200 hover:bg-primary-50"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite to Portal
              </Button>
              <Button
                variant="outline"
                onClick={handleSuspend}
                disabled={suspendMutation.isPending}
                className="text-orange-700 border-orange-200 hover:bg-orange-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Suspend
              </Button>
            </>
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

          {/* Portal Access - Only show for approved suppliers */}
          {supplier.status === 'APPROVED' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-neutral-400" />
                    <CardTitle>Portal Access</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInviteDialogOpen(true)}
                      className="h-8 px-2"
                      title="Invite new user"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setManagePortalDialogOpen(true)}
                      className="h-8 px-2"
                      title="Manage portal access"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Portal Users */}
                {usersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : portalUsers && portalUsers.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Active Users
                    </p>
                    {portalUsers.map((user: PortalUser) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary-700">
                              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm">
                            <p className="font-medium text-neutral-900">
                              {user.full_name || user.email}
                            </p>
                            <p className="text-xs text-neutral-500">{user.role}</p>
                          </div>
                        </div>
                        <Badge variant={user.access_status === 'ACTIVE' ? 'success' : 'default'}>
                          {user.access_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">No portal users yet</p>
                )}

                {/* Pending Invitations */}
                {invitationsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : portalInvitations && portalInvitations.filter((inv: PortalInvitation) => inv.status === 'PENDING').length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Pending Invitations
                    </p>
                    {portalInvitations
                      .filter((inv: PortalInvitation) => inv.status === 'PENDING')
                      .map((invitation: PortalInvitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="text-sm text-neutral-700">{invitation.email}</span>
                          </div>
                          <Badge variant="warning">Pending</Badge>
                        </div>
                      ))}
                  </div>
                ) : null}

                {/* Empty state when no users and no pending invitations */}
                {!usersLoading && !invitationsLoading &&
                 (!portalUsers || portalUsers.length === 0) &&
                 (!portalInvitations || portalInvitations.filter((inv: PortalInvitation) => inv.status === 'PENDING').length === 0) && (
                  <div className="text-center py-4">
                    <Users className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No portal access configured</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteDialogOpen(true)}
                      className="mt-2"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Send Invitation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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

      {/* Invite to Portal Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={closeInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary-600" />
              Invite to Supplier Portal
            </DialogTitle>
            <DialogDescription>
              Send an invitation to a supplier contact to access the portal for{' '}
              <span className="font-medium">{supplier.name}</span>.
            </DialogDescription>
          </DialogHeader>

          {lastInvitation ? (
            // Success state - show the invitation link
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Invitation Sent!</span>
                </div>
                <p className="text-sm text-emerald-600">
                  An email invitation has been sent to{' '}
                  <span className="font-medium">{lastInvitation.email}</span>
                </p>
              </div>

              {lastInvitation.registration_url && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Registration Link</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={lastInvitation.registration_url}
                      readOnly
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInviteLink(lastInvitation.registration_url!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Share this link with the supplier contact if they didn't receive the email.
                  </p>
                </div>
              )}

              <div className="text-xs text-neutral-500">
                <p>
                  <span className="font-medium">Expires:</span>{' '}
                  {formatDateTime(lastInvitation.expires_at)}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeInviteDialog}>
                  Close
                </Button>
                <Button
                  onClick={() => setLastInvitation(null)}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send Another
                </Button>
              </DialogFooter>
            </div>
          ) : (
            // Form state - input email and send invitation
            <form onSubmit={inviteForm.handleSubmit(handleInviteToPortal)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@supplier.com"
                  {...inviteForm.register('email')}
                />
                {inviteForm.formState.errors.email && (
                  <p className="text-sm text-red-500">
                    {inviteForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="personal_message">
                  Personal Message <span className="text-neutral-400">(optional)</span>
                </Label>
                <Textarea
                  id="personal_message"
                  placeholder="Add a personal message to the invitation email..."
                  rows={3}
                  {...inviteForm.register('personal_message')}
                />
              </div>

              <Separator />

              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-600">
                  <span className="font-medium">What happens next:</span>
                </p>
                <ul className="text-xs text-neutral-500 mt-1 space-y-1">
                  <li>• An email will be sent with a registration link</li>
                  <li>• The contact can create their portal account</li>
                  <li>• They'll be able to view RFQs and manage POs</li>
                </ul>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeInviteDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="gap-2"
                >
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Portal Access Dialog */}
      {supplier.status === 'APPROVED' && (
        <ManagePortalAccessDialog
          open={managePortalDialogOpen}
          onOpenChange={setManagePortalDialogOpen}
          supplierId={supplier.id}
          supplierName={supplier.name}
          onInviteNew={() => {
            setManagePortalDialogOpen(false);
            setInviteDialogOpen(true);
          }}
        />
      )}
    </motion.div>
  );
}

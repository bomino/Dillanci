import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  ArrowRight,
  FileText,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useApprovalThresholds,
  useCreateApprovalThreshold,
  useUpdateApprovalThreshold,
  useDeleteApprovalThreshold,
  useRoles,
} from '@/lib/api/admin';
import type { ApprovalThreshold } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const documentTypes = [
  { value: 'REQUISITION', label: 'Requisitions', icon: <FileText className="h-5 w-5" /> },
  { value: 'PURCHASE_ORDER', label: 'Purchase Orders', icon: <ShoppingCart className="h-5 w-5" /> },
  { value: 'INVOICE', label: 'Invoices', icon: <Receipt className="h-5 w-5" /> },
];

interface ThresholdRowProps {
  threshold: ApprovalThreshold;
  onUpdate: (data: Partial<ApprovalThreshold>) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
  roles: Array<{ id: string; name: string }>;
}

function ThresholdRow({ threshold, onUpdate, onDelete, isUpdating, isDeleting, roles }: ThresholdRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [minAmount, setMinAmount] = useState(threshold.min_amount);
  const [maxAmount, setMaxAmount] = useState(threshold.max_amount || '');
  const [requiredRole, setRequiredRole] = useState(threshold.required_role || '');
  const [autoApprove, setAutoApprove] = useState(threshold.auto_approve);

  const handleSave = () => {
    onUpdate({
      min_amount: minAmount,
      max_amount: maxAmount || null,
      required_role: requiredRole || null,
      auto_approve: autoApprove,
    });
    setIsEditing(false);
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return 'Unlimited';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: threshold.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  if (isEditing) {
    return (
      <tr className="bg-indigo-50">
        <td className="px-4 py-3">
          <Input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-32"
            placeholder="0"
          />
        </td>
        <td className="px-4 py-3">
          <Input
            type="number"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="w-32"
            placeholder="Unlimited"
          />
        </td>
        <td className="px-4 py-3">
          <Select value={requiredRole} onValueChange={setRequiredRole}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any role</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-4 py-3">
          <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
              <Save className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3 font-medium text-neutral-900">
        {formatCurrency(threshold.min_amount)}
      </td>
      <td className="px-4 py-3 text-neutral-700">
        {formatCurrency(threshold.max_amount)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neutral-400" />
          <span className="text-neutral-700">{threshold.required_role_name || 'Any role'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {threshold.auto_approve ? (
          <span className="inline-flex items-center gap-1 text-green-700 text-sm">
            <CheckCircle className="h-4 w-4" />
            Auto
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-neutral-500 text-sm">
            <Clock className="h-4 w-4" />
            Manual
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

interface WorkflowDiagramProps {
  documentType: string;
}

interface WorkflowStage {
  label: string;
  status: string;
  isFinal?: boolean;
  isNegative?: boolean;
}

function WorkflowDiagram({ documentType }: WorkflowDiagramProps) {
  const stages: Record<string, WorkflowStage[]> = {
    REQUISITION: [
      { label: 'Draft', status: 'draft' },
      { label: 'Submitted', status: 'submitted' },
      { label: 'Under Review', status: 'review' },
      { label: 'Approved', status: 'approved' },
      { label: 'Rejected', status: 'rejected', isFinal: true, isNegative: true },
    ],
    PURCHASE_ORDER: [
      { label: 'Draft', status: 'draft' },
      { label: 'Pending Approval', status: 'pending' },
      { label: 'Approved', status: 'approved' },
      { label: 'Sent to Supplier', status: 'sent' },
      { label: 'Confirmed', status: 'confirmed' },
      { label: 'Partially Received', status: 'partial' },
      { label: 'Complete', status: 'complete', isFinal: true },
    ],
    INVOICE: [
      { label: 'Received', status: 'received' },
      { label: 'Under Review', status: 'review' },
      { label: 'Approved', status: 'approved' },
      { label: 'Scheduled', status: 'scheduled' },
      { label: 'Paid', status: 'paid', isFinal: true },
    ],
  };

  const currentStages = stages[documentType] || stages.REQUISITION;

  return (
    <div className="flex items-center justify-center gap-2 py-6 overflow-x-auto">
      {currentStages.map((stage, index) => (
        <div key={stage.status} className="flex items-center">
          <div
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap',
              stage.isFinal && !stage.isNegative && 'bg-green-100 text-green-800 border border-green-200',
              stage.isNegative && 'bg-red-100 text-red-800 border border-red-200',
              !stage.isFinal && !stage.isNegative && 'bg-neutral-100 text-neutral-700 border border-neutral-200'
            )}
          >
            {stage.label}
          </div>
          {index < currentStages.length - 1 && !currentStages[index + 1]?.isNegative && (
            <ArrowRight className="h-4 w-4 text-neutral-400 mx-1 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState('REQUISITION');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newThreshold, setNewThreshold] = useState({
    document_type: 'REQUISITION',
    min_amount: '',
    max_amount: '',
    required_role: '',
    auto_approve: false,
    currency: 'USD',
  });

  const { data: thresholds, isLoading } = useApprovalThresholds({ document_type: activeTab });
  const { data: rolesData } = useRoles();
  const createMutation = useCreateApprovalThreshold();
  const updateMutation = useUpdateApprovalThreshold();
  const deleteMutation = useDeleteApprovalThreshold();

  const roles = rolesData?.results || [];

  const handleCreateThreshold = async () => {
    try {
      await createMutation.mutateAsync({
        document_type: activeTab as 'REQUISITION' | 'PURCHASE_ORDER' | 'INVOICE',
        min_amount: newThreshold.min_amount,
        max_amount: newThreshold.max_amount || null,
        required_role: newThreshold.required_role || null,
        auto_approve: newThreshold.auto_approve,
        currency: newThreshold.currency,
      });
      setCreateDialogOpen(false);
      setNewThreshold({
        document_type: activeTab,
        min_amount: '',
        max_amount: '',
        required_role: '',
        auto_approve: false,
        currency: 'USD',
      });
    } catch (error) {
      console.error('Failed to create threshold:', error);
    }
  };

  const handleUpdateThreshold = async (id: string, data: Partial<ApprovalThreshold>) => {
    try {
      await updateMutation.mutateAsync({ id, ...data });
    } catch (error) {
      console.error('Failed to update threshold:', error);
    }
  };

  const handleDeleteThreshold = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete threshold:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Approval Workflows</h1>
            <p className="text-neutral-500">Configure approval thresholds and rules</p>
          </div>
        </div>
      </div>

      {/* Tabs for document types */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          {documentTypes.map((type) => (
            <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-2">
              {type.icon}
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {documentTypes.map((type) => (
          <TabsContent key={type.value} value={type.value} className="space-y-6">
            {/* Workflow Diagram */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {type.icon}
                  {type.label} Workflow
                </CardTitle>
                <CardDescription>
                  Visual representation of the approval workflow stages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowDiagram documentType={type.value} />
              </CardContent>
            </Card>

            {/* Approval Thresholds */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Approval Thresholds</CardTitle>
                  <CardDescription>
                    Configure amount-based approval requirements
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setNewThreshold({ ...newThreshold, document_type: type.value });
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Threshold
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : thresholds?.results && thresholds.results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Min Amount
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Max Amount
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Required Approvers
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Auto-Approve
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {thresholds.results.map((threshold) => (
                          <ThresholdRow
                            key={threshold.id}
                            threshold={threshold}
                            onUpdate={(data) => handleUpdateThreshold(threshold.id, data)}
                            onDelete={() => handleDeleteThreshold(threshold.id)}
                            isUpdating={updateMutation.isPending}
                            isDeleting={deleteMutation.isPending}
                            roles={roles}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-500 mb-4">No approval thresholds configured</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNewThreshold({ ...newThreshold, document_type: type.value });
                        setCreateDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Threshold
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workflow Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Rules</CardTitle>
                <CardDescription>Additional workflow configuration options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {type.value === 'REQUISITION' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">Budget Check Required</p>
                        <p className="text-sm text-neutral-500">
                          Require budget availability verification before approval
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">Auto-Convert to PO</p>
                        <p className="text-sm text-neutral-500">
                          Automatically create PO when requisition is approved
                        </p>
                      </div>
                      <Switch />
                    </div>
                  </>
                )}
                {type.value === 'PURCHASE_ORDER' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">Auto-Approve from Requisition</p>
                        <p className="text-sm text-neutral-500">
                          Skip approval if created from an approved requisition
                        </p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">Notify Supplier on Approval</p>
                        <p className="text-sm text-neutral-500">
                          Send email notification to supplier when PO is approved
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </>
                )}
                {type.value === 'INVOICE' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">Three-Way Match Required</p>
                        <p className="text-sm text-neutral-500">
                          Require PO and receipt match before invoice approval
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">Variance Tolerance</p>
                        <p className="text-sm text-neutral-500">
                          Maximum allowed variance from PO amount
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="number" defaultValue="5" className="w-20" />
                        <span className="text-neutral-500">%</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">Escalation Timeout</p>
                    <p className="text-sm text-neutral-500">
                      Auto-escalate if not approved within specified hours
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" defaultValue="48" className="w-20" />
                    <span className="text-neutral-500">hours</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Threshold Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Approval Threshold</DialogTitle>
            <DialogDescription>
              Define a new approval threshold for {documentTypes.find((t) => t.value === activeTab)?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Min Amount</label>
                <Input
                  type="number"
                  value={newThreshold.min_amount}
                  onChange={(e) => setNewThreshold({ ...newThreshold, min_amount: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Max Amount</label>
                <Input
                  type="number"
                  value={newThreshold.max_amount}
                  onChange={(e) => setNewThreshold({ ...newThreshold, max_amount: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Required Role</label>
                <Select
                  value={newThreshold.required_role}
                  onValueChange={(value) => setNewThreshold({ ...newThreshold, required_role: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Any role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any role</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Currency</label>
                <Select
                  value={newThreshold.currency}
                  onValueChange={(value) => setNewThreshold({ ...newThreshold, currency: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-neutral-900">Auto-Approve</p>
                <p className="text-sm text-neutral-500">
                  Automatically approve items in this range
                </p>
              </div>
              <Switch
                checked={newThreshold.auto_approve}
                onCheckedChange={(checked) => setNewThreshold({ ...newThreshold, auto_approve: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateThreshold} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Threshold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

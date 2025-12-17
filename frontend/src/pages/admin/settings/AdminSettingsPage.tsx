import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Save,
  Building2,
  Bell,
  Shield,
  Link2,
  Globe,
  Calendar,
  Hash,
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/badge';
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
  useSystemPreferences,
  useBulkUpdatePreferences,
  useAPIKeys,
  useCreateAPIKey,
  useRevokeAPIKey,
  useRegenerateAPIKey,
} from '@/lib/api/admin';
import type { APIKey } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
];

const currencies = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (\u20AC)' },
  { value: 'GBP', label: 'British Pound (\u00A3)' },
  { value: 'NGN', label: 'Nigerian Naira (\u20A6)' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' },
];

const dateFormats = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (EU)' },
];

interface APIKeyRowProps {
  apiKey: APIKey;
  onRevoke: () => void;
  onRegenerate: () => void;
  isRevoking: boolean;
  isRegenerating: boolean;
}

function APIKeyRow({ apiKey, onRevoke, onRegenerate, isRevoking, isRegenerating }: APIKeyRowProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey.key_prefix + '...');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center">
            <Key className="h-5 w-5 text-neutral-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{apiKey.name}</p>
            <p className="text-sm text-neutral-500 font-mono">
              {showKey ? apiKey.key_prefix + '••••••••' : '••••••••••••••••'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 ml-13 text-xs text-neutral-500">
          <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
          {apiKey.last_used_at && (
            <span>Last used: {new Date(apiKey.last_used_at).toLocaleDateString()}</span>
          )}
          {apiKey.expires_at && (
            <span>Expires: {new Date(apiKey.expires_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={apiKey.is_active ? 'active' : 'cancelled'} />
        <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={copyToClipboard}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
        {apiKey.is_active && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={cn('h-4 w-4', isRegenerating && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600"
              onClick={onRevoke}
              disabled={isRevoking}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [createKeyDialogOpen, setCreateKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Local state for form values
  const [formValues, setFormValues] = useState<Record<string, string | boolean | number>>({});

  const { data: preferences, isLoading: _prefsLoading } = useSystemPreferences();
  const { data: apiKeys, isLoading: keysLoading } = useAPIKeys();
  const bulkUpdateMutation = useBulkUpdatePreferences();
  const createKeyMutation = useCreateAPIKey();
  const revokeKeyMutation = useRevokeAPIKey();
  const regenerateKeyMutation = useRegenerateAPIKey();

  // Initialize form values from preferences
  const getPreferenceValue = (key: string, defaultValue: string | boolean | number = '') => {
    if (formValues[key] !== undefined) return formValues[key];
    const pref = preferences?.results?.find((p) => p.key === key);
    return pref?.value ?? defaultValue;
  };

  const setPreferenceValue = (key: string, value: string | boolean | number) => {
    setFormValues({ ...formValues, [key]: value });
    setUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    try {
      const updates = Object.entries(formValues).map(([key, value]) => ({
        key,
        value: typeof value === 'boolean' ? value : value.toString(),
      }));
      await bulkUpdateMutation.mutateAsync(updates);
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const handleCreateAPIKey = async () => {
    try {
      const result = await createKeyMutation.mutateAsync({
        name: newKeyName,
        expires_at: newKeyExpiry || undefined,
      });
      setCreatedKey(result.key || null);
      setNewKeyName('');
      setNewKeyExpiry('');
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeKeyMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const handleRegenerateKey = async (id: string) => {
    try {
      const result = await regenerateKeyMutation.mutateAsync(id);
      setCreatedKey(result.key || null);
      setCreateKeyDialogOpen(true);
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
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
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">System Settings</h1>
            <p className="text-neutral-500">Configure organization preferences</p>
          </div>
        </div>
        {unsavedChanges && (
          <Button onClick={handleSaveChanges} disabled={bulkUpdateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {bulkUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Unsaved Changes Banner */}
      {unsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-amber-800">You have unsaved changes</p>
        </div>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Basic information about your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Organization Name</label>
                  <Input
                    value={getPreferenceValue('organization_name', '') as string}
                    onChange={(e) => setPreferenceValue('organization_name', e.target.value)}
                    placeholder="Enter organization name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Business Email</label>
                  <Input
                    type="email"
                    value={getPreferenceValue('business_email', '') as string}
                    onChange={(e) => setPreferenceValue('business_email', e.target.value)}
                    placeholder="contact@company.com"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Business Address</label>
                <Textarea
                  value={getPreferenceValue('business_address', '') as string}
                  onChange={(e) => setPreferenceValue('business_address', e.target.value)}
                  placeholder="Enter full business address"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
              <CardDescription>Configure timezone, currency, and format preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Timezone
                  </label>
                  <Select
                    value={getPreferenceValue('timezone', 'UTC') as string}
                    onValueChange={(value) => setPreferenceValue('timezone', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Default Currency
                  </label>
                  <Select
                    value={getPreferenceValue('default_currency', 'USD') as string}
                    onValueChange={(value) => setPreferenceValue('default_currency', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date Format
                  </label>
                  <Select
                    value={getPreferenceValue('date_format', 'MM/DD/YYYY') as string}
                    onValueChange={(value) => setPreferenceValue('date_format', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map((fmt) => (
                        <SelectItem key={fmt.value} value={fmt.value}>
                          {fmt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fiscal Year Start
                  </label>
                  <Select
                    value={getPreferenceValue('fiscal_year_start', '1') as string}
                    onValueChange={(value) => setPreferenceValue('fiscal_year_start', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ].map((month, index) => (
                        <SelectItem key={month} value={(index + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure when to send email notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Requisition Submitted</p>
                  <p className="text-sm text-neutral-500">Notify approvers when a new requisition is submitted</p>
                </div>
                <Switch
                  checked={getPreferenceValue('notify_requisition_submitted', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('notify_requisition_submitted', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Requisition Approved/Rejected</p>
                  <p className="text-sm text-neutral-500">Notify requester when their requisition is processed</p>
                </div>
                <Switch
                  checked={getPreferenceValue('notify_requisition_decision', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('notify_requisition_decision', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Purchase Order Created</p>
                  <p className="text-sm text-neutral-500">Notify supplier when a new PO is issued</p>
                </div>
                <Switch
                  checked={getPreferenceValue('notify_po_created', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('notify_po_created', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Invoice Due Reminder</p>
                  <p className="text-sm text-neutral-500">Send reminder before invoice due date</p>
                </div>
                <Switch
                  checked={getPreferenceValue('notify_invoice_due', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('notify_invoice_due', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Contract Expiry Alert</p>
                  <p className="text-sm text-neutral-500">Send alert before contract expiration</p>
                </div>
                <Switch
                  checked={getPreferenceValue('notify_contract_expiry', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('notify_contract_expiry', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure notification timing and frequency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Daily Digest</p>
                  <p className="text-sm text-neutral-500">Send a summary of activities at end of day</p>
                </div>
                <Switch
                  checked={getPreferenceValue('daily_digest', false) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('daily_digest', checked)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Contract Expiry Warning (days)</label>
                <Input
                  type="number"
                  value={getPreferenceValue('contract_expiry_warning_days', '30') as string}
                  onChange={(e) => setPreferenceValue('contract_expiry_warning_days', e.target.value)}
                  className="mt-1 w-32"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Invoice Due Reminder (days before)</label>
                <Input
                  type="number"
                  value={getPreferenceValue('invoice_due_reminder_days', '3') as string}
                  onChange={(e) => setPreferenceValue('invoice_due_reminder_days', e.target.value)}
                  className="mt-1 w-32"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password Policy</CardTitle>
              <CardDescription>Configure password requirements for users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Minimum Password Length</p>
                  <p className="text-sm text-neutral-500">Minimum number of characters required</p>
                </div>
                <Input
                  type="number"
                  value={getPreferenceValue('password_min_length', '8') as string}
                  onChange={(e) => setPreferenceValue('password_min_length', e.target.value)}
                  className="w-20"
                  min="6"
                  max="32"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Require Special Characters</p>
                  <p className="text-sm text-neutral-500">Password must contain special characters</p>
                </div>
                <Switch
                  checked={getPreferenceValue('password_require_special', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('password_require_special', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Require Numbers</p>
                  <p className="text-sm text-neutral-500">Password must contain at least one number</p>
                </div>
                <Switch
                  checked={getPreferenceValue('password_require_numbers', true) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('password_require_numbers', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Password Expiry (days)</p>
                  <p className="text-sm text-neutral-500">Force password change after N days (0 = never)</p>
                </div>
                <Input
                  type="number"
                  value={getPreferenceValue('password_expiry_days', '90') as string}
                  onChange={(e) => setPreferenceValue('password_expiry_days', e.target.value)}
                  className="w-20"
                  min="0"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Settings</CardTitle>
              <CardDescription>Configure session and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Session Timeout (minutes)</p>
                  <p className="text-sm text-neutral-500">Auto logout after inactivity</p>
                </div>
                <Input
                  type="number"
                  value={getPreferenceValue('session_timeout_minutes', '60') as string}
                  onChange={(e) => setPreferenceValue('session_timeout_minutes', e.target.value)}
                  className="w-20"
                  min="5"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Two-Factor Authentication</p>
                  <p className="text-sm text-neutral-500">Require 2FA for all users</p>
                </div>
                <Switch
                  checked={getPreferenceValue('require_2fa', false) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('require_2fa', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Single Session Only</p>
                  <p className="text-sm text-neutral-500">Allow only one active session per user</p>
                </div>
                <Switch
                  checked={getPreferenceValue('single_session', false) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('single_session', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>IP Whitelist</CardTitle>
              <CardDescription>Restrict access to specific IP addresses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Enable IP Whitelist</p>
                  <p className="text-sm text-neutral-500">Only allow access from specified IPs</p>
                </div>
                <Switch
                  checked={getPreferenceValue('ip_whitelist_enabled', false) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('ip_whitelist_enabled', checked)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Allowed IP Addresses</label>
                <Textarea
                  value={getPreferenceValue('ip_whitelist', '') as string}
                  onChange={(e) => setPreferenceValue('ip_whitelist', e.target.value)}
                  placeholder="Enter one IP address per line"
                  className="mt-1 font-mono"
                  rows={4}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  One IP address per line. Supports CIDR notation (e.g., 192.168.1.0/24)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Settings */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage API keys for third-party integrations</CardDescription>
              </div>
              <Button onClick={() => setCreateKeyDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </CardHeader>
            <CardContent>
              {keysLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : apiKeys?.results && apiKeys.results.length > 0 ? (
                <div className="space-y-4">
                  {apiKeys.results.map((key) => (
                    <APIKeyRow
                      key={key.id}
                      apiKey={key}
                      onRevoke={() => handleRevokeKey(key.id)}
                      onRegenerate={() => handleRegenerateKey(key.id)}
                      isRevoking={revokeKeyMutation.isPending}
                      isRegenerating={regenerateKeyMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Key className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500 mb-4">No API keys created yet</p>
                  <Button variant="outline" onClick={() => setCreateKeyDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First API Key
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Configure webhook endpoints for event notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Webhook URL</label>
                <Input
                  value={getPreferenceValue('webhook_url', '') as string}
                  onChange={(e) => setPreferenceValue('webhook_url', e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Webhook Secret</label>
                <Input
                  type="password"
                  value={getPreferenceValue('webhook_secret', '') as string}
                  onChange={(e) => setPreferenceValue('webhook_secret', e.target.value)}
                  placeholder="Enter webhook secret for signature verification"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Enable Webhooks</p>
                  <p className="text-sm text-neutral-500">Send event notifications to webhook URL</p>
                </div>
                <Switch
                  checked={getPreferenceValue('webhooks_enabled', false) as boolean}
                  onCheckedChange={(checked) => setPreferenceValue('webhooks_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={createKeyDialogOpen} onOpenChange={setCreateKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? 'Copy your new API key now. You won\'t be able to see it again.'
                : 'Create a new API key for third-party integrations'}
            </DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className="py-4">
              <div className="bg-neutral-900 rounded-lg p-4">
                <code className="text-green-400 text-sm break-all">{createdKey}</code>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => {
                  navigator.clipboard.writeText(createdKey);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Key Name</label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Expiry Date (optional)</label>
                <Input
                  type="date"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {createdKey ? (
              <Button
                onClick={() => {
                  setCreateKeyDialogOpen(false);
                  setCreatedKey(null);
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateKeyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAPIKey}
                  disabled={!newKeyName || createKeyMutation.isPending}
                >
                  {createKeyMutation.isPending ? 'Creating...' : 'Create Key'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

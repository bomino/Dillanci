import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Building2,
  Bell,
  Shield,
  Globe,
  Mail,
  CreditCard,
  Users,
  FileText,
  Save,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const settingSections: SettingSection[] = [
  { id: 'organization', title: 'Organization', description: 'Company details and branding', icon: <Building2 className="h-5 w-5" /> },
  { id: 'notifications', title: 'Notifications', description: 'Email and alert preferences', icon: <Bell className="h-5 w-5" /> },
  { id: 'security', title: 'Security', description: 'Authentication and access control', icon: <Shield className="h-5 w-5" /> },
  { id: 'approvals', title: 'Approval Workflows', description: 'Configure approval thresholds', icon: <FileText className="h-5 w-5" /> },
  { id: 'integrations', title: 'Integrations', description: 'Connect external systems', icon: <Globe className="h-5 w-5" /> },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('organization');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
            <Settings className="h-6 w-6 text-neutral-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>
            <p className="text-neutral-500">Manage your organization settings</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {showSaved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Settings Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {settingSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {section.icon}
                    <div className="text-left">
                      <p className="font-medium">{section.title}</p>
                    </div>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="flex-1 space-y-6">
          {activeSection === 'organization' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>Basic information about your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organization Name</Label>
                      <Input id="orgName" defaultValue="Acme Corporation" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgCode">Organization Code</Label>
                      <Input id="orgCode" defaultValue="ACME" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" defaultValue="123 Business Ave, Suite 100&#10;San Francisco, CA 94102" rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" defaultValue="+1 (415) 555-0100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue="procurement@acme.com" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Regional Settings</CardTitle>
                  <CardDescription>Currency, date format, and localization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Default Currency</Label>
                      <Select defaultValue="USD">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date Format</Label>
                      <Select defaultValue="mdy">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select defaultValue="pst">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                          <SelectItem value="mst">Mountain Time (MT)</SelectItem>
                          <SelectItem value="cst">Central Time (CT)</SelectItem>
                          <SelectItem value="est">Eastern Time (ET)</SelectItem>
                          <SelectItem value="utc">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'notifications' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Configure when you receive email alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {[
                      { id: 'req-approved', label: 'Requisition approved', description: 'When your requisition is approved' },
                      { id: 'req-rejected', label: 'Requisition rejected', description: 'When your requisition is rejected' },
                      { id: 'po-created', label: 'Purchase order created', description: 'When a new PO is created from your requisition' },
                      { id: 'invoice-received', label: 'Invoice received', description: 'When a new invoice is received' },
                      { id: 'contract-expiring', label: 'Contract expiring', description: 'When a contract is expiring soon' },
                      { id: 'approval-pending', label: 'Approval pending', description: 'When items require your approval' },
                    ].map((item) => (
                      <div key={item.id} className="flex items-start space-x-3">
                        <Checkbox id={item.id} defaultChecked />
                        <div className="space-y-1">
                          <Label htmlFor={item.id} className="font-medium cursor-pointer">
                            {item.label}
                          </Label>
                          <p className="text-sm text-neutral-500">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notification Frequency</CardTitle>
                  <CardDescription>How often you want to receive digest emails</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select defaultValue="daily">
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time (Immediately)</SelectItem>
                      <SelectItem value="hourly">Hourly Digest</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'security' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Password Policy</CardTitle>
                  <CardDescription>Set password requirements for all users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Password Length</Label>
                      <Select defaultValue="12">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8">8 characters</SelectItem>
                          <SelectItem value="10">10 characters</SelectItem>
                          <SelectItem value="12">12 characters</SelectItem>
                          <SelectItem value="16">16 characters</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password Expiry</Label>
                      <Select defaultValue="90">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { id: 'uppercase', label: 'Require uppercase letters' },
                      { id: 'lowercase', label: 'Require lowercase letters' },
                      { id: 'numbers', label: 'Require numbers' },
                      { id: 'special', label: 'Require special characters' },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox id={item.id} defaultChecked />
                        <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>Require 2FA for additional security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="require-2fa" />
                    <Label htmlFor="require-2fa" className="cursor-pointer">
                      Require 2FA for all users
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="require-2fa-admins" defaultChecked />
                    <Label htmlFor="require-2fa-admins" className="cursor-pointer">
                      Require 2FA for administrators only
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Session Settings</CardTitle>
                  <CardDescription>Control user session behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Session Timeout</Label>
                    <Select defaultValue="60">
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="480">8 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'approvals' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Requisition Approval Thresholds</CardTitle>
                  <CardDescription>Set approval requirements based on amount</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Up to</Label>
                        <Input type="number" defaultValue="1000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Approver Level</Label>
                        <Select defaultValue="manager">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto-approve</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="vp">VP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-neutral-500 pb-2">
                        Single approval required
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>$1,001 - $10,000</Label>
                        <Input type="number" defaultValue="10000" disabled />
                      </div>
                      <div className="space-y-2">
                        <Select defaultValue="director">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="vp">VP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-neutral-500 pb-2">
                        Manager + Director approval
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Over $10,000</Label>
                        <Input type="number" placeholder="No limit" disabled />
                      </div>
                      <div className="space-y-2">
                        <Select defaultValue="vp">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="vp">VP</SelectItem>
                            <SelectItem value="cfo">CFO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-neutral-500 pb-2">
                        Full approval chain
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>PO Approval Settings</CardTitle>
                  <CardDescription>Configure purchase order approval rules</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="auto-po" defaultChecked />
                    <Label htmlFor="auto-po" className="cursor-pointer">
                      Auto-approve POs from approved requisitions
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="require-budget" defaultChecked />
                    <Label htmlFor="require-budget" className="cursor-pointer">
                      Require budget check before approval
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="notify-supplier" defaultChecked />
                    <Label htmlFor="notify-supplier" className="cursor-pointer">
                      Automatically notify supplier on PO approval
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'integrations' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Connected Systems</CardTitle>
                  <CardDescription>Manage integrations with external systems</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Accounting System (QuickBooks)</p>
                        <p className="text-sm text-neutral-500">Sync invoices and payments</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600">Connected</span>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">HR System (Workday)</p>
                        <p className="text-sm text-neutral-500">Sync employee and department data</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600">Connected</span>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium">Email Service (SendGrid)</p>
                        <p className="text-sm text-neutral-500">Send transactional emails</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-500">Not connected</span>
                      <Button variant="outline" size="sm">Connect</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API Access</CardTitle>
                  <CardDescription>Manage API keys for custom integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <Input value="sk_live_xxxxxxxxxxxxxxxxxxxxx" type="password" readOnly className="font-mono" />
                      <Button variant="outline">Reveal</Button>
                      <Button variant="outline">Regenerate</Button>
                    </div>
                    <p className="text-sm text-neutral-500">Keep this key secure. Never share it publicly.</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

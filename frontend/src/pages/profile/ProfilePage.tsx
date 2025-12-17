import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Building2,
  Calendar,
  Shield,
  Key,
  Bell,
  Activity,
  Save,
  Check,
  Camera,
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
import { useAuthStore } from '@/stores/auth-store';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'activity'>('profile');

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Mock activity data
  const recentActivity = [
    { id: '1', action: 'Created requisition', details: 'REQ-2024-0089', time: '2 hours ago' },
    { id: '2', action: 'Approved purchase order', details: 'PO-2024-0045', time: '5 hours ago' },
    { id: '3', action: 'Updated supplier', details: 'TechPro Solutions', time: '1 day ago' },
    { id: '4', action: 'Submitted RFQ', details: 'RFQ-2024-0012', time: '2 days ago' },
    { id: '5', action: 'Confirmed goods receipt', details: 'GR-2024-0034', time: '3 days ago' },
    { id: '6', action: 'Created contract', details: 'CON-2024-0008', time: '4 days ago' },
    { id: '7', action: 'Matched invoice', details: 'INV-2024-0067', time: '5 days ago' },
    { id: '8', action: 'Approved requisition', details: 'REQ-2024-0082', time: '1 week ago' },
  ];

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
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-sahel-500 flex items-center justify-center text-white text-xl font-semibold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <button className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-neutral-800 flex items-center justify-center text-white hover:bg-neutral-700 transition-colors">
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              {user?.first_name} {user?.last_name}
            </h1>
            <p className="text-neutral-500">{user?.email}</p>
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

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex gap-4">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'activity', label: 'Activity', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sahel-500 text-sahel-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue={user?.first_name || 'John'} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue={user?.last_name || 'Doe'} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" defaultValue={user?.email || 'john.doe@company.com'} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" defaultValue="+1 (415) 555-0123" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extension">Extension</Label>
                    <Input id="extension" defaultValue="1234" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Work Information</CardTitle>
                <CardDescription>Your role and department details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input id="jobTitle" defaultValue="Procurement Manager" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select defaultValue="procurement">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="procurement">Procurement</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="it">IT</SelectItem>
                        <SelectItem value="hr">Human Resources</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manager">Reports To</Label>
                    <Input id="manager" defaultValue="Sarah Johnson" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Office Location</Label>
                    <Select defaultValue="sf">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sf">San Francisco, CA</SelectItem>
                        <SelectItem value="ny">New York, NY</SelectItem>
                        <SelectItem value="chi">Chicago, IL</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Organization</p>
                    <p className="font-medium">{user?.organization_name || 'Acme Corporation'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Role</p>
                    <p className="font-medium">{user?.is_staff ? 'Administrator' : 'User'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Member Since</p>
                    <p className="font-medium">
                      {user?.date_joined
                        ? new Date(user.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'January 15, 2024'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Last Login</p>
                    <p className="font-medium">
                      {user?.last_login
                        ? new Date(user.last_login).toLocaleString('en-US')
                        : 'Today at 9:32 AM'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approval Authority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Requisitions</span>
                  <span className="font-medium">Up to $10,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Purchase Orders</span>
                  <span className="font-medium">Up to $25,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Contracts</span>
                  <span className="font-medium">Up to $50,000</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password regularly for security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input id="confirmPassword" type="password" />
              </div>
              <Button className="gap-2">
                <Key className="h-4 w-4" />
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Authenticator App</p>
                  <p className="text-sm text-neutral-500">Use an app like Google Authenticator</p>
                </div>
                <Button variant="outline">Enable</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">SMS Authentication</p>
                  <p className="text-sm text-neutral-500">Receive codes via text message</p>
                </div>
                <Button variant="outline">Enable</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your active login sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                <div>
                  <p className="font-medium text-green-900">Current Session</p>
                  <p className="text-sm text-green-700">Chrome on Windows - San Francisco, CA</p>
                  <p className="text-xs text-green-600">Started: Today at 9:32 AM</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Safari on iPhone</p>
                  <p className="text-sm text-neutral-500">San Francisco, CA</p>
                  <p className="text-xs text-neutral-400">Last active: Yesterday</p>
                </div>
                <Button variant="outline" size="sm">Revoke</Button>
              </div>
              <Button variant="outline" className="w-full">Sign Out All Other Sessions</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Choose what you want to be notified about</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 'approval-requests', label: 'Approval Requests', description: 'When items need your approval' },
                { id: 'req-status', label: 'Requisition Status Updates', description: 'When your requisitions are approved or rejected' },
                { id: 'po-status', label: 'PO Status Updates', description: 'When purchase orders change status' },
                { id: 'delivery', label: 'Delivery Notifications', description: 'When orders are received' },
                { id: 'invoice-due', label: 'Invoice Due Reminders', description: 'When invoices are approaching due date' },
                { id: 'contract-expiry', label: 'Contract Expiry Alerts', description: 'When contracts are expiring soon' },
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>How you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email Digest Frequency</Label>
                <Select defaultValue="realtime">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Send immediately</SelectItem>
                    <SelectItem value="hourly">Hourly digest</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="desktop" defaultChecked />
                <Label htmlFor="desktop" className="cursor-pointer">
                  Enable desktop notifications
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent actions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-neutral-500" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{item.action}</p>
                      <p className="text-sm text-neutral-500">{item.details}</p>
                    </div>
                  </div>
                  <span className="text-sm text-neutral-400">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

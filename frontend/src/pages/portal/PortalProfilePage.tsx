/**
 * Portal Profile Page - Manage user profile and company information.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Save,
  Loader2,
  CheckCircle,
  Shield,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import {
  fetchPortalProfile,
  updatePortalProfile,
  fetchPortalSupplier,
  updatePortalSupplier,
  type PortalUser,
  type PortalSupplier,
} from '@/lib/api/portal';
import { usePortalUser, usePortalSupplier, usePortalStore } from '@/stores/portal-store';
import { toast } from 'sonner';

// User profile schema
const userProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
});

type UserProfileFormData = z.infer<typeof userProfileSchema>;

// Company profile schema
const companyProfileSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  contact_name: z.string().optional(),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

type CompanyProfileFormData = z.infer<typeof companyProfileSchema>;

export default function PortalProfilePage() {
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [userData, setUserData] = useState<PortalUser | null>(null);
  const [companyData, setCompanyData] = useState<PortalSupplier | null>(null);

  const storeUser = usePortalUser();
  const storeSupplier = usePortalSupplier();
  const setAuth = usePortalStore((state) => state.setAuth);

  // User profile form
  const userForm = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
    },
  });

  // Company profile form
  const companyForm = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
    },
  });

  // Load user profile
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const profile = await fetchPortalProfile();
        setUserData(profile);
        userForm.reset({
          first_name: profile.first_name,
          last_name: profile.last_name,
        });
      } catch (err) {
        console.error('Failed to load user profile:', err);
        // Fall back to store data
        if (storeUser) {
          setUserData(storeUser as PortalUser);
          userForm.reset({
            first_name: storeUser.first_name,
            last_name: storeUser.last_name,
          });
        }
      } finally {
        setIsLoadingUser(false);
      }
    }
    loadUserProfile();
  }, [storeUser]);

  // Load company profile
  useEffect(() => {
    async function loadCompanyProfile() {
      try {
        const company = await fetchPortalSupplier();
        setCompanyData(company);
        companyForm.reset({
          name: company.name || '',
          contact_name: company.contact_name || '',
          contact_email: company.contact_email || '',
          contact_phone: company.contact_phone || '',
          address_line1: company.address_line1 || '',
          address_line2: company.address_line2 || '',
          city: company.city || '',
          state: company.state || '',
          postal_code: company.postal_code || '',
          country: company.country || '',
        });
      } catch (err) {
        console.error('Failed to load company profile:', err);
        // Fall back to store data
        if (storeSupplier) {
          setCompanyData(storeSupplier as PortalSupplier);
          companyForm.reset({
            name: storeSupplier.name || '',
            contact_name: storeSupplier.contact_name || '',
            contact_email: storeSupplier.contact_email || '',
            contact_phone: storeSupplier.contact_phone || '',
            address_line1: storeSupplier.address_line1 || '',
            address_line2: storeSupplier.address_line2 || '',
            city: storeSupplier.city || '',
            state: storeSupplier.state || '',
            postal_code: storeSupplier.postal_code || '',
            country: storeSupplier.country || '',
          });
        }
      } finally {
        setIsLoadingCompany(false);
      }
    }
    loadCompanyProfile();
  }, [storeSupplier]);

  // Save user profile
  const handleSaveUser = async (data: UserProfileFormData) => {
    setIsSavingUser(true);
    try {
      const updated = await updatePortalProfile(data);
      setUserData(updated);
      // Update store with new user data
      if (storeSupplier) {
        setAuth(updated, storeSupplier);
      }
      toast.success('Profile updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(message);
    } finally {
      setIsSavingUser(false);
    }
  };

  // Save company profile
  const handleSaveCompany = async (data: CompanyProfileFormData) => {
    setIsSavingCompany(true);
    try {
      const updated = await updatePortalSupplier(data);
      setCompanyData(updated);
      // Update store with new supplier data
      if (storeUser) {
        setAuth(storeUser, updated);
      }
      toast.success('Company profile updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update company profile';
      toast.error(message);
    } finally {
      setIsSavingCompany(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your personal information and company details.
        </p>
      </div>

      {/* User Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-100">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUser ? (
              <UserProfileSkeleton />
            ) : (
              <form onSubmit={userForm.handleSubmit(handleSaveUser)} className="space-y-6">
                {/* Role Badge */}
                {userData?.role && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-50">
                    <Shield className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm text-neutral-600">Role:</span>
                    <Badge variant="outline" className="font-medium">
                      {userData.role}
                    </Badge>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" required>First Name</Label>
                    <Input
                      id="first_name"
                      {...userForm.register('first_name')}
                      error={userForm.formState.errors.first_name?.message}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" required>Last Name</Label>
                    <Input
                      id="last_name"
                      {...userForm.register('last_name')}
                      error={userForm.formState.errors.last_name?.message}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-50 border">
                    <Mail className="h-4 w-4 text-neutral-400" />
                    <span className="text-sm text-neutral-600">{userData?.email}</span>
                    <Badge variant="outline" className="ml-auto text-xs">Read-only</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Contact your administrator to change your email address.
                  </p>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingUser || !userForm.formState.isDirty}>
                    {isSavingUser ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Company Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Company Information</CardTitle>
                <CardDescription>Manage your company profile and contact details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingCompany ? (
              <CompanyProfileSkeleton />
            ) : (
              <form onSubmit={companyForm.handleSubmit(handleSaveCompany)} className="space-y-6">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" required>Company Name</Label>
                  <Input
                    id="name"
                    {...companyForm.register('name')}
                    error={companyForm.formState.errors.name?.message}
                  />
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-900 mb-4">Contact Information</h4>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Contact Name</Label>
                      <Input
                        id="contact_name"
                        placeholder="John Smith"
                        {...companyForm.register('contact_name')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_email">Contact Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="contact_email"
                          type="email"
                          placeholder="contact@company.com"
                          className="pl-9"
                          {...companyForm.register('contact_email')}
                        />
                      </div>
                      {companyForm.formState.errors.contact_email && (
                        <p className="text-xs text-red-500">
                          {companyForm.formState.errors.contact_email.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_phone">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          id="contact_phone"
                          placeholder="+1 (555) 123-4567"
                          className="pl-9"
                          {...companyForm.register('contact_phone')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-900 mb-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Business Address
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address_line1">Street Address</Label>
                      <Input
                        id="address_line1"
                        placeholder="123 Main Street"
                        {...companyForm.register('address_line1')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_line2">Address Line 2</Label>
                      <Input
                        id="address_line2"
                        placeholder="Suite 100"
                        {...companyForm.register('address_line2')}
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-2 col-span-2 sm:col-span-1">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="New York"
                          {...companyForm.register('city')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State/Province</Label>
                        <Input
                          id="state"
                          placeholder="NY"
                          {...companyForm.register('state')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postal_code">Postal Code</Label>
                        <Input
                          id="postal_code"
                          placeholder="10001"
                          {...companyForm.register('postal_code')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          placeholder="USA"
                          {...companyForm.register('country')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingCompany || !companyForm.formState.isDirty}>
                    {isSavingCompany ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Company Profile
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Your account is active</p>
                <p className="text-sm text-green-700 mt-1">
                  You have full access to view RFQs, submit bids, and manage purchase orders.
                  {userData?.last_login_at && (
                    <span className="block mt-1 text-green-600">
                      Last login: {new Date(userData.last_login_at).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// User Profile Skeleton
function UserProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid sm:grid-cols-2 gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// Company Profile Skeleton
function CompanyProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full" />
      <div className="grid sm:grid-cols-3 gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

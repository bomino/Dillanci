import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2 } from 'lucide-react';

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
import { FieldWrapper as FormField } from '@/components/ui/form-field';

import type { Supplier, SupplierStatus } from '@/types';
import type { SupplierPayload } from '@/lib/api/suppliers';

// Validation schema
const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  legal_name: z.string().max(200).nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  duns_number: z.string().max(9).nullable().optional(),
  status: z.enum(['PROSPECT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'BLOCKED']).optional(),
  supplier_type: z.enum(['MANUFACTURER', 'DISTRIBUTOR', 'SERVICE_PROVIDER', 'CONTRACTOR', 'OTHER']),
  address_line_1: z.string().max(255).nullable().optional(),
  address_line_2: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  country: z.string().max(100).default('USA'),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  website: z.string().url('Invalid URL').nullable().optional().or(z.literal('')),
  payment_terms: z.string().max(50).default('NET30'),
  currency: z.string().max(3).default('USD'),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  initialData?: Supplier;
  onSubmit: (data: SupplierPayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

export default function SupplierForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
}: SupplierFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: initialData?.name || '',
      legal_name: initialData?.legal_name || '',
      tax_id: initialData?.tax_id || '',
      duns_number: initialData?.duns_number || '',
      status: initialData?.status || 'PROSPECT',
      supplier_type: initialData?.supplier_type || 'OTHER',
      address_line_1: initialData?.address_line_1 || '',
      address_line_2: initialData?.address_line_2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || 'USA',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      website: initialData?.website || '',
      payment_terms: initialData?.payment_terms || 'NET30',
      currency: initialData?.currency || 'USD',
    },
  });

  const supplierType = watch('supplier_type');
  const status = watch('status');

  const handleFormSubmit = (data: SupplierFormData) => {
    // Transform form data to API payload
    const payload: SupplierPayload = {
      name: data.name,
      legal_name: data.legal_name || null,
      tax_id: data.tax_id || null,
      duns_number: data.duns_number || null,
      status: data.status,
      supplier_type: data.supplier_type,
      address_line_1: data.address_line_1 || null,
      address_line_2: data.address_line_2 || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      country: data.country,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      payment_terms: data.payment_terms,
      currency: data.currency,
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Building2 className="h-5 w-5 text-primary-700" />
            </div>
            <div>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Primary supplier details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Supplier Name" error={errors.name?.message} required>
              <Input
                {...register('name')}
                placeholder="Enter supplier name"
                error={!!errors.name}
              />
            </FormField>

            <FormField label="Legal Name" error={errors.legal_name?.message}>
              <Input
                {...register('legal_name')}
                placeholder="Legal entity name (if different)"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Supplier Type" error={errors.supplier_type?.message} required>
              <Select
                value={supplierType}
                onValueChange={(value) => setValue('supplier_type', value as SupplierFormData['supplier_type'])}
              >
                <SelectTrigger error={!!errors.supplier_type}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUFACTURER">Manufacturer</SelectItem>
                  <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                  <SelectItem value="SERVICE_PROVIDER">Service Provider</SelectItem>
                  <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Tax ID" error={errors.tax_id?.message}>
              <Input
                {...register('tax_id')}
                placeholder="e.g., 12-3456789"
              />
            </FormField>

            <FormField label="D-U-N-S Number" error={errors.duns_number?.message}>
              <Input
                {...register('duns_number')}
                placeholder="9-digit number"
                maxLength={9}
              />
            </FormField>
          </div>

          {mode === 'edit' && (
            <FormField label="Status" error={errors.status?.message}>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as SupplierStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          )}
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>How to reach this supplier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Email" error={errors.email?.message}>
              <Input
                type="email"
                {...register('email')}
                placeholder="contact@supplier.com"
                error={!!errors.email}
              />
            </FormField>

            <FormField label="Phone" error={errors.phone?.message}>
              <Input
                {...register('phone')}
                placeholder="(555) 123-4567"
              />
            </FormField>

            <FormField label="Website" error={errors.website?.message}>
              <Input
                {...register('website')}
                placeholder="https://www.supplier.com"
                error={!!errors.website}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Physical location of the supplier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Address Line 1" error={errors.address_line_1?.message}>
            <Input
              {...register('address_line_1')}
              placeholder="Street address"
            />
          </FormField>

          <FormField label="Address Line 2" error={errors.address_line_2?.message}>
            <Input
              {...register('address_line_2')}
              placeholder="Suite, unit, building, floor, etc."
            />
          </FormField>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="City" error={errors.city?.message}>
              <Input
                {...register('city')}
                placeholder="City"
              />
            </FormField>

            <FormField label="State/Province" error={errors.state?.message}>
              <Input
                {...register('state')}
                placeholder="State"
              />
            </FormField>

            <FormField label="Postal Code" error={errors.postal_code?.message}>
              <Input
                {...register('postal_code')}
                placeholder="ZIP/Postal"
              />
            </FormField>

            <FormField label="Country" error={errors.country?.message}>
              <Input
                {...register('country')}
                placeholder="Country"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Payment Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Terms</CardTitle>
          <CardDescription>Default payment settings for this supplier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Payment Terms" error={errors.payment_terms?.message}>
              <Select
                value={watch('payment_terms')}
                onValueChange={(value) => setValue('payment_terms', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREPAID">Prepaid</SelectItem>
                  <SelectItem value="COD">Cash on Delivery (COD)</SelectItem>
                  <SelectItem value="NET15">Net 15</SelectItem>
                  <SelectItem value="NET30">Net 30</SelectItem>
                  <SelectItem value="NET45">Net 45</SelectItem>
                  <SelectItem value="NET60">Net 60</SelectItem>
                  <SelectItem value="NET90">Net 90</SelectItem>
                  <SelectItem value="2_10_NET30">2/10 Net 30</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Currency" error={errors.currency?.message}>
              <Select
                value={watch('currency')}
                onValueChange={(value) => setValue('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
            ? 'Create Supplier'
            : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Shield, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldWrapper } from '@/components/ui/form-field';
import { useInviteUser, useRoles } from '@/lib/api/admin';
import { Checkbox } from '@/components/ui/checkbox';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: rolesData } = useRoles();
  const inviteMutation = useInviteUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const onSubmit = async (data: InviteFormData) => {
    try {
      const result = await inviteMutation.mutateAsync({
        ...data,
        role_ids: selectedRoles,
      });
      setInviteResult({
        email: data.email,
        tempPassword: result.temp_password,
      });
    } catch (error) {
      console.error('Failed to invite user:', error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setInviteResult(null);
    setSelectedRoles([]);
    setCopied(false);
    reset();
  };

  const copyToClipboard = async () => {
    if (inviteResult?.tempPassword) {
      await navigator.clipboard.writeText(inviteResult.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success state
  if (inviteResult) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-center">User Invited Successfully</DialogTitle>
            <DialogDescription className="text-center">
              An invitation has been sent to <strong>{inviteResult.email}</strong>
            </DialogDescription>
          </DialogHeader>

          {inviteResult.tempPassword && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-amber-800 font-medium mb-2">Temporary Password</p>
              <p className="text-xs text-amber-600 mb-3">
                Share this password securely with the user. They will be prompted to change it on first login.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border border-amber-200 text-sm font-mono">
                  {inviteResult.tempPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FieldWrapper label="Email Address" error={errors.email?.message} required>
            <Input
              type="email"
              placeholder="john.doe@company.com"
              {...register('email')}
            />
          </FieldWrapper>

          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="First Name" error={errors.first_name?.message} required>
              <Input placeholder="John" {...register('first_name')} />
            </FieldWrapper>
            <FieldWrapper label="Last Name" error={errors.last_name?.message} required>
              <Input placeholder="Doe" {...register('last_name')} />
            </FieldWrapper>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Assign Roles (Optional)
            </label>
            <p className="text-xs text-neutral-500 mb-3">
              Select one or more roles to assign to this user
            </p>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {rolesData?.results?.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={() => handleRoleToggle(role.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium text-sm">{role.name}</span>
                      {role.is_system_role && (
                        <span className="text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                          System
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">
                        {role.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
              {!rolesData?.results?.length && (
                <div className="p-4 text-center text-sm text-neutral-500">
                  No roles available. Create roles first.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

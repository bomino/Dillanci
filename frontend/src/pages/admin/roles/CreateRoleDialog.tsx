import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldWrapper } from '@/components/ui/form-field';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateRole, usePermissions } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const roleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().min(1, 'Code is required').max(50).regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  description: z.string().optional(),
  approval_limit: z.string().optional(),
  currency: z.string(),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const { data: permissionGroups } = usePermissions();
  const createMutation = useCreateRole();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      approval_limit: '',
      currency: 'USD',
    },
  });

  // Auto-generate code from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    setValue('code', code);
  };

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleAllInModule = (_module: string, permissions: { code: string }[]) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const moduleCodes = permissions.map((p) => p.code);
      const allSelected = moduleCodes.every((code) => prev.has(code));

      if (allSelected) {
        moduleCodes.forEach((code) => next.delete(code));
      } else {
        moduleCodes.forEach((code) => next.add(code));
      }
      return next;
    });
  };

  const onSubmit = async (data: RoleFormData) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        permissions: Array.from(selectedPermissions),
        approval_limit: data.approval_limit || null,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setSelectedPermissions(new Set());
    setExpandedModules(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle>Create Custom Role</DialogTitle>
              <DialogDescription>
                Define a new role with specific permissions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <FieldWrapper label="Role Name" error={errors.name?.message} required>
                <Input
                  placeholder="e.g., Senior Buyer"
                  {...register('name')}
                  onChange={(e) => {
                    register('name').onChange(e);
                    handleNameChange(e);
                  }}
                />
              </FieldWrapper>

              <FieldWrapper label="Role Code" error={errors.code?.message} required>
                <Input
                  placeholder="e.g., senior_buyer"
                  {...register('code')}
                  className="font-mono"
                />
              </FieldWrapper>

              <FieldWrapper label="Description" error={errors.description?.message}>
                <Textarea
                  placeholder="Describe what this role is for..."
                  {...register('description')}
                  rows={2}
                />
              </FieldWrapper>

              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="Approval Limit" error={errors.approval_limit?.message}>
                  <Input
                    type="number"
                    placeholder="e.g., 10000"
                    {...register('approval_limit')}
                  />
                </FieldWrapper>
                <FieldWrapper label="Currency" error={errors.currency?.message}>
                  <Input {...register('currency')} />
                </FieldWrapper>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-3 block">
                Permissions ({selectedPermissions.size} selected)
              </label>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {permissionGroups?.map((group) => {
                  const isExpanded = expandedModules.has(group.module);
                  const selectedCount = group.permissions.filter((p) =>
                    selectedPermissions.has(p.code)
                  ).length;
                  const allSelected = selectedCount === group.permissions.length;
                  const someSelected = selectedCount > 0 && !allSelected;

                  return (
                    <div key={group.module}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleModule(group.module)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleModule(group.module);
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={allSelected}
                            ref={undefined}
                            onCheckedChange={() => toggleAllInModule(group.module, group.permissions)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(someSelected && 'data-[state=unchecked]:bg-indigo-200')}
                          />
                          <span className="font-medium">{group.label}</span>
                          <span className="text-xs text-neutral-500">
                            {selectedCount}/{group.permissions.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                      {isExpanded && (
                        <div className="pl-10 pr-3 pb-3 space-y-1">
                          {group.permissions.map((permission) => (
                            <label
                              key={permission.code}
                              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedPermissions.has(permission.code)}
                                onCheckedChange={() => togglePermission(permission.code)}
                              />
                              <span className="text-sm">{permission.label}</span>
                              <span className="text-xs text-neutral-400 font-mono ml-auto">
                                {permission.code}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import * as React from 'react';
import { Users, Plus, X, CheckCircle, Clock, UserCog, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

export type EvaluatorRole = 'LEAD' | 'TECHNICAL' | 'FINANCIAL' | 'GENERAL';

export interface EvaluationTeamMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: EvaluatorRole;
  has_submitted_scores: boolean;
  scores_submitted_at: string | null;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

interface EvaluationTeamPanelProps {
  rfpId: string;
  team: EvaluationTeamMember[];
  availableUsers: AvailableUser[];
  onAddMember: (userId: string, role: EvaluatorRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: EvaluatorRole) => Promise<void>;
  isEditable?: boolean;
  className?: string;
}

const roleConfig: Record<EvaluatorRole, { label: string; color: string; bgColor: string }> = {
  LEAD: { label: 'Lead', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  TECHNICAL: { label: 'Technical', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  FINANCIAL: { label: 'Financial', color: 'text-green-700', bgColor: 'bg-green-100' },
  GENERAL: { label: 'General', color: 'text-neutral-700', bgColor: 'bg-neutral-100' },
};

export function EvaluationTeamPanel({
  team,
  availableUsers,
  onAddMember,
  onRemoveMember,
  onUpdateRole,
  isEditable = true,
  className,
}: EvaluationTeamPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<EvaluatorRole>('GENERAL');
  const [isAdding, setIsAdding] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  // Filter out users who are already on the team
  const teamUserIds = new Set(team.map(m => m.user_id));
  const availableForAdding = availableUsers.filter(u => !teamUserIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUserId || !selectedRole) return;
    setIsAdding(true);
    try {
      await onAddMember(selectedUserId, selectedRole);
      setAddDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('GENERAL');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await onRemoveMember(memberId);
    } finally {
      setRemovingId(null);
    }
  };

  const completedCount = team.filter(m => m.has_submitted_scores).length;
  const totalCount = team.length;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Evaluation Team
          {totalCount > 0 && (
            <span className="text-sm font-normal text-neutral-500">
              ({completedCount}/{totalCount} completed)
            </span>
          )}
        </CardTitle>
        {isEditable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            disabled={availableForAdding.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Member
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">No team members assigned</p>
            {isEditable && (
              <p className="text-neutral-400 text-xs mt-1">
                Add evaluators to start scoring proposals
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {team.map((member) => {
              const role = roleConfig[member.role];
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                      <span className="text-sm font-medium text-primary-700">
                        {member.user_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">
                          {member.user_name}
                        </span>
                        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', role.bgColor, role.color)}>
                          {role.label}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500">{member.user_email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.has_submitted_scores ? (
                      <div className="flex items-center gap-1 text-emerald-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>Submitted</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>Pending</span>
                      </div>
                    )}

                    {isEditable && (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(value) => onUpdateRole(member.id, value as EvaluatorRole)}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <UserCog className="h-3 w-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(member.id)}
                          disabled={removingId === member.id}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
                        >
                          {removingId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Evaluation Team Member</DialogTitle>
            <DialogDescription>
              Select a user and assign their role on the evaluation team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableForAdding.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs text-neutral-500">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Role</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as EvaluatorRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.color)}>
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedUserId || isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default EvaluationTeamPanel;

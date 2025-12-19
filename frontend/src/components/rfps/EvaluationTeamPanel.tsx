import { useState } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  Calculator,
  Wrench,
  User,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types for export
export type EvaluatorRole = 'LEAD' | 'TECHNICAL' | 'PRICING' | 'GENERAL' | 'FINANCIAL';

export interface EvaluationTeamMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: EvaluatorRole;
  has_submitted_scores: boolean;
  scores_submitted_at: string | null;
  assigned_sections?: string[];
  completion_percentage?: number;
}

export interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

interface EvaluationTeamPanelProps {
  rfpId: string;
  team: EvaluationTeamMember[];
  availableUsers?: AvailableUser[];
  onAddMember?: (userId: string, role: EvaluatorRole) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  onUpdateRole?: (memberId: string, role: EvaluatorRole) => Promise<void>;
  isEditable?: boolean;
}

// Role configuration
const ROLE_CONFIG: Record<EvaluatorRole, { label: string; icon: typeof User; color: string; description: string }> = {
  LEAD: {
    label: 'Lead Evaluator',
    icon: Shield,
    color: 'text-purple-600 bg-purple-100 border-purple-200',
    description: 'Oversees evaluation process and final scoring',
  },
  TECHNICAL: {
    label: 'Technical',
    icon: Wrench,
    color: 'text-blue-600 bg-blue-100 border-blue-200',
    description: 'Evaluates technical capabilities and solutions',
  },
  PRICING: {
    label: 'Pricing',
    icon: Calculator,
    color: 'text-green-600 bg-green-100 border-green-200',
    description: 'Reviews pricing and cost structures',
  },
  FINANCIAL: {
    label: 'Financial',
    icon: Calculator,
    color: 'text-emerald-600 bg-emerald-100 border-emerald-200',
    description: 'Assesses financial health and risk',
  },
  GENERAL: {
    label: 'General',
    icon: User,
    color: 'text-neutral-600 bg-neutral-100 border-neutral-200',
    description: 'General evaluation responsibilities',
  },
};

export function EvaluationTeamPanel({
  rfpId: _rfpId,
  team,
  availableUsers = [],
  onAddMember,
  onRemoveMember,
  onUpdateRole,
  isEditable = true,
}: EvaluationTeamPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<EvaluatorRole>('GENERAL');
  const [isAdding, setIsAdding] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<EvaluationTeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);

  // Filter available users to exclude already added members
  const availableToAdd = availableUsers.filter(
    (user) => !team.some((member) => member.user_id === user.id)
  );

  // Calculate team stats
  const teamStats = {
    total: team.length,
    submitted: team.filter((m) => m.has_submitted_scores).length,
    completionPercentage:
      team.length > 0
        ? (team.filter((m) => m.has_submitted_scores).length / team.length) * 100
        : 0,
  };

  // Get lead evaluator
  const leadEvaluator = team.find((m) => m.role === 'LEAD');

  // Handle add member
  const handleAddMember = async () => {
    if (!selectedUserId || !onAddMember) return;

    setIsAdding(true);
    try {
      await onAddMember(selectedUserId, selectedRole);
      toast.success('Team member added successfully');
      setIsAddDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('GENERAL');
    } catch {
      toast.error('Failed to add team member');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = async () => {
    if (!memberToRemove || !onRemoveMember) return;

    setIsRemoving(true);
    try {
      await onRemoveMember(memberToRemove.id);
      toast.success('Team member removed');
      setMemberToRemove(null);
    } catch {
      toast.error('Failed to remove team member');
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle role change
  const handleRoleChange = async (memberId: string, newRole: EvaluatorRole) => {
    if (!onUpdateRole) return;

    setIsUpdatingRole(memberId);
    try {
      await onUpdateRole(memberId, newRole);
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    } finally {
      setIsUpdatingRole(null);
    }
  };

  // Render role badge
  const RoleBadge = ({ role }: { role: EvaluatorRole }) => {
    const config = ROLE_CONFIG[role];
    const Icon = config.icon;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{config.description}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Render status badge
  const StatusBadge = ({ member }: { member: EvaluationTeamMember }) => {
    if (member.has_submitted_scores) {
      return (
        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      );
    }

    if (member.completion_percentage && member.completion_percentage > 0) {
      return (
        <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          {member.completion_percentage.toFixed(0)}% Complete
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-neutral-500 bg-neutral-50 border-neutral-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-600" />
              Evaluation Team
            </CardTitle>
            <CardDescription>
              Manage evaluators and track scoring progress
            </CardDescription>
          </div>

          {isEditable && onAddMember && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Evaluator
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Select a user and assign their evaluation role.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">User</label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAdd.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-neutral-500">
                            No users available to add
                          </div>
                        ) : (
                          availableToAdd.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                <span className="text-xs text-neutral-500">{user.email}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as EvaluatorRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span>{config.label}</span>
                                <span className="text-xs text-neutral-500">{config.description}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddMember} disabled={!selectedUserId || isAdding}>
                    {isAdding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Member'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Team progress */}
        {team.length > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-neutral-600">
                  {teamStats.submitted} of {teamStats.total} evaluators submitted
                </span>
                <span className="text-sm font-medium">
                  {teamStats.completionPercentage.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={teamStats.completionPercentage}
                className={`h-2 ${
                  teamStats.completionPercentage === 100
                    ? '[&>div]:bg-green-500'
                    : '[&>div]:bg-primary-500'
                }`}
              />
            </div>
            {teamStats.completionPercentage === 100 && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Submitted
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {team.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-neutral-500 font-medium">No team members assigned</p>
            <p className="text-sm text-neutral-400 mt-1">
              Add evaluators to begin the scoring process
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {/* Lead evaluator first */}
              {leadEvaluator && (
                <div
                  key={leadEvaluator.id}
                  className="flex items-center justify-between p-3 rounded-lg border-2 border-purple-200 bg-purple-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-purple-700" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{leadEvaluator.user_name}</p>
                      <p className="text-sm text-neutral-500">{leadEvaluator.user_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge member={leadEvaluator} />
                    <RoleBadge role={leadEvaluator.role} />

                    {isEditable && onRemoveMember && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToRemove(leadEvaluator)}
                              className="text-neutral-500 hover:text-red-600"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove from team</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )}

              {/* Other team members */}
              {team
                .filter((m) => m.role !== 'LEAD')
                .map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-neutral-500" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{member.user_name}</p>
                        <p className="text-sm text-neutral-500">{member.user_email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge member={member} />

                      {isEditable && onUpdateRole ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={ROLE_CONFIG[member.role].color}
                              disabled={isUpdatingRole === member.id}
                            >
                              {isUpdatingRole === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  {ROLE_CONFIG[member.role].label}
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                              <DropdownMenuItem
                                key={key}
                                onClick={() => handleRoleChange(member.id, key as EvaluatorRole)}
                                className={member.role === key ? 'bg-neutral-100' : ''}
                              >
                                <config.icon className="h-4 w-4 mr-2" />
                                {config.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}

                      {isEditable && onRemoveMember && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemberToRemove(member)}
                                className="text-neutral-500 hover:text-red-600"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove from team</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}

        {/* Summary */}
        {team.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-purple-500" />
                  {leadEvaluator ? '1 Lead' : 'No Lead'}
                </span>
                <span className="flex items-center gap-1">
                  <Wrench className="h-4 w-4 text-blue-500" />
                  {team.filter((m) => m.role === 'TECHNICAL').length} Technical
                </span>
                <span className="flex items-center gap-1">
                  <Calculator className="h-4 w-4 text-green-500" />
                  {team.filter((m) => m.role === 'PRICING').length} Pricing
                </span>
              </div>
              {!leadEvaluator && team.length > 0 && (
                <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No lead evaluator assigned
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user_name} from the evaluation team?
              {memberToRemove?.has_submitted_scores && (
                <span className="block mt-2 text-amber-600">
                  This evaluator has already submitted scores. Their scores will remain in the system.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default EvaluationTeamPanel;

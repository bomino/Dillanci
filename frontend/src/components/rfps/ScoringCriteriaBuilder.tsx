import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Scale,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import type { ScoringCriteria, RFPSection } from '@/types';

// Local type for editable criteria (before saving)
export interface EditableCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  section_id: string | null;
  parent_id: string | null;
  order: number;
  sub_criteria: EditableCriterion[];
  isNew?: boolean;
  isExpanded?: boolean;
}

interface ScoringCriteriaBuilderProps {
  criteria: ScoringCriteria[];
  sections?: RFPSection[];
  onChange: (criteria: EditableCriterion[]) => void;
  isEditable?: boolean;
  maxTotalWeight?: number;
}

// Convert API type to editable type
function toEditableCriteria(criteria: ScoringCriteria[]): EditableCriterion[] {
  return criteria.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    weight: parseFloat(c.weight) || 0,
    max_score: parseFloat(c.max_score) || 100,
    section_id: c.section,
    parent_id: c.parent,
    order: c.order,
    sub_criteria: c.sub_criteria ? toEditableCriteria(c.sub_criteria) : [],
    isExpanded: true,
  }));
}

// Generate unique ID for new criteria
function generateId(): string {
  return `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ScoringCriteriaBuilder({
  criteria,
  sections = [],
  onChange,
  isEditable = true,
  maxTotalWeight = 100,
}: ScoringCriteriaBuilderProps) {
  const [editableCriteria, setEditableCriteria] = useState<EditableCriterion[]>(() =>
    toEditableCriteria(criteria)
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return editableCriteria.reduce((sum, c) => sum + c.weight, 0);
  }, [editableCriteria]);

  const weightRemaining = maxTotalWeight - totalWeight;
  const isWeightValid = Math.abs(totalWeight - maxTotalWeight) < 0.01;

  // Toggle expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Add new criterion
  const addCriterion = (parentId: string | null = null) => {
    const newCriterion: EditableCriterion = {
      id: generateId(),
      name: '',
      description: '',
      weight: 0,
      max_score: 100,
      section_id: null,
      parent_id: parentId,
      order: parentId
        ? editableCriteria.find((c) => c.id === parentId)?.sub_criteria.length || 0
        : editableCriteria.length,
      sub_criteria: [],
      isNew: true,
      isExpanded: true,
    };

    if (parentId) {
      // Add as sub-criterion
      const updated = editableCriteria.map((c) => {
        if (c.id === parentId) {
          return {
            ...c,
            sub_criteria: [...c.sub_criteria, newCriterion],
          };
        }
        return c;
      });
      setEditableCriteria(updated);
      onChange(updated);
    } else {
      // Add as top-level criterion
      const updated = [...editableCriteria, newCriterion];
      setEditableCriteria(updated);
      onChange(updated);
    }

    // Expand parent if adding sub-criterion
    if (parentId) {
      setExpandedIds((prev) => new Set([...prev, parentId]));
    }
  };

  // Update criterion
  const updateCriterion = (
    id: string,
    field: keyof EditableCriterion,
    value: string | number | null
  ) => {
    const updateInList = (list: EditableCriterion[]): EditableCriterion[] => {
      return list.map((c) => {
        if (c.id === id) {
          return { ...c, [field]: value };
        }
        if (c.sub_criteria.length > 0) {
          return { ...c, sub_criteria: updateInList(c.sub_criteria) };
        }
        return c;
      });
    };

    const updated = updateInList(editableCriteria);
    setEditableCriteria(updated);
    onChange(updated);
  };

  // Delete criterion
  const deleteCriterion = (id: string) => {
    const deleteFromList = (list: EditableCriterion[]): EditableCriterion[] => {
      return list
        .filter((c) => c.id !== id)
        .map((c) => ({
          ...c,
          sub_criteria: deleteFromList(c.sub_criteria),
        }));
    };

    const updated = deleteFromList(editableCriteria);
    setEditableCriteria(updated);
    onChange(updated);
  };

  // Render a single criterion row
  const renderCriterion = (criterion: EditableCriterion, depth: number = 0) => {
    const isExpanded = expandedIds.has(criterion.id);
    const hasSubCriteria = criterion.sub_criteria.length > 0;

    return (
      <div key={criterion.id} className="space-y-2">
        <div
          className={`
            flex items-start gap-3 p-3 rounded-lg border transition-colors
            ${depth > 0 ? 'ml-8 bg-neutral-50' : 'bg-white'}
            ${criterion.isNew ? 'border-primary-200 bg-primary-50/30' : 'border-neutral-200'}
          `}
        >
          {/* Drag handle */}
          {isEditable && (
            <div className="pt-2 cursor-grab text-neutral-400 hover:text-neutral-600">
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          {/* Expand/collapse for items with sub-criteria */}
          <div className="pt-2">
            {hasSubCriteria || depth === 0 ? (
              <button
                type="button"
                onClick={() => toggleExpand(criterion.id)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-3">
            {/* Name and weight row */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Criterion name"
                  value={criterion.name}
                  onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                  disabled={!isEditable}
                  className={criterion.name ? '' : 'border-amber-300'}
                />
              </div>

              {/* Weight */}
              <div className="w-24">
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Weight"
                    value={criterion.weight || ''}
                    onChange={(e) =>
                      updateCriterion(criterion.id, 'weight', parseFloat(e.target.value) || 0)
                    }
                    disabled={!isEditable}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                    %
                  </span>
                </div>
              </div>

              {/* Max score */}
              <div className="w-24">
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="Max"
                  value={criterion.max_score || ''}
                  onChange={(e) =>
                    updateCriterion(criterion.id, 'max_score', parseInt(e.target.value) || 100)
                  }
                  disabled={!isEditable}
                />
              </div>

              {/* Section selector (only for top-level) */}
              {depth === 0 && sections.length > 0 && (
                <div className="w-40">
                  <Select
                    value={criterion.section_id || 'none'}
                    onValueChange={(value) =>
                      updateCriterion(criterion.id, 'section_id', value === 'none' ? null : value)
                    }
                    disabled={!isEditable}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link to section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No section</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Delete button */}
              {isEditable && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Criterion</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{criterion.name || 'this criterion'}"?
                        {hasSubCriteria && ' This will also delete all sub-criteria.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteCriterion(criterion.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Description */}
            <Textarea
              placeholder="Description (optional) - explain how this criterion will be evaluated"
              value={criterion.description}
              onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
              disabled={!isEditable}
              className="min-h-[60px] text-sm"
            />

            {/* Add sub-criterion button */}
            {isEditable && depth === 0 && isExpanded && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addCriterion(criterion.id)}
                className="text-xs text-primary-600"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Sub-Criterion
              </Button>
            )}
          </div>
        </div>

        {/* Sub-criteria */}
        {isExpanded && hasSubCriteria && (
          <div className="space-y-2">
            {criterion.sub_criteria.map((sub) => renderCriterion(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary-600" />
              Scoring Criteria
            </CardTitle>
            <CardDescription>
              Define weighted criteria for evaluating proposals
            </CardDescription>
          </div>

          {/* Weight summary */}
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {totalWeight.toFixed(1)}% / {maxTotalWeight}%
                      </p>
                      <Progress
                        value={(totalWeight / maxTotalWeight) * 100}
                        className={`w-24 h-2 ${
                          isWeightValid
                            ? '[&>div]:bg-green-500'
                            : totalWeight > maxTotalWeight
                              ? '[&>div]:bg-red-500'
                              : '[&>div]:bg-amber-500'
                        }`}
                      />
                    </div>
                    {isWeightValid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle
                        className={`h-5 w-5 ${
                          totalWeight > maxTotalWeight ? 'text-red-500' : 'text-amber-500'
                        }`}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isWeightValid ? (
                    <p>Weights sum to {maxTotalWeight}%</p>
                  ) : totalWeight > maxTotalWeight ? (
                    <p>Weights exceed {maxTotalWeight}% by {(totalWeight - maxTotalWeight).toFixed(1)}%</p>
                  ) : (
                    <p>{weightRemaining.toFixed(1)}% remaining to allocate</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {editableCriteria.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-neutral-500 font-medium">No scoring criteria defined</p>
            <p className="text-sm text-neutral-400 mt-1">
              Add criteria to define how proposals will be scored
            </p>
            {isEditable && (
              <Button onClick={() => addCriterion()} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add First Criterion
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-3 px-3 text-xs font-medium text-neutral-500 uppercase">
              {isEditable && <div className="w-4" />}
              <div className="w-4" />
              <div className="flex-1">Name & Description</div>
              <div className="w-24 text-center">Weight</div>
              <div className="w-24 text-center">Max Score</div>
              {sections.length > 0 && <div className="w-40 text-center">Section</div>}
              {isEditable && <div className="w-9" />}
            </div>

            {/* Criteria list */}
            {editableCriteria.map((criterion) => renderCriterion(criterion))}

            {/* Add criterion button */}
            {isEditable && (
              <Button
                type="button"
                variant="outline"
                onClick={() => addCriterion()}
                className="w-full mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Criterion
              </Button>
            )}
          </div>
        )}

        {/* Weight validation message */}
        {editableCriteria.length > 0 && !isWeightValid && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              totalWeight > maxTotalWeight
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              {totalWeight > maxTotalWeight
                ? `Total weight exceeds ${maxTotalWeight}%. Please reduce weights by ${(totalWeight - maxTotalWeight).toFixed(1)}%.`
                : `Weights total ${totalWeight.toFixed(1)}%. Allocate remaining ${weightRemaining.toFixed(1)}% to reach ${maxTotalWeight}%.`}
            </span>
          </div>
        )}

        {/* Summary badges */}
        {editableCriteria.length > 0 && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <Badge variant="outline">
              {editableCriteria.length} criteria
            </Badge>
            <Badge variant="outline">
              {editableCriteria.reduce((sum, c) => sum + c.sub_criteria.length, 0)} sub-criteria
            </Badge>
            <Badge variant={isWeightValid ? 'success' : 'warning'}>
              {totalWeight.toFixed(1)}% allocated
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScoringCriteriaBuilder;

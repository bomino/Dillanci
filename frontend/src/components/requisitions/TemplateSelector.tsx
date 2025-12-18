import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  Search,
  ChevronRight,
  X,
  Star,
  Clock,
  User,
  Package,
  Building2,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
  useRequisitionTemplates,
  useIncrementTemplateUseCount,
  type RequisitionTemplate,
} from '@/lib/api/requisition-templates';
import { departmentOptions } from '@/lib/api/requisitions';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: RequisitionTemplate) => void;
}

const priorityConfig = {
  LOW: { label: 'Low', color: 'bg-neutral-100 text-neutral-700' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  HIGH: { label: 'High', color: 'bg-amber-100 text-amber-700' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

function TemplateCard({
  template,
  onSelect,
  isSelected,
}: {
  template: RequisitionTemplate;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const departmentLabel =
    departmentOptions.find((d) => d.value === template.department)?.label || template.department;
  const priority = priorityConfig[template.priority];

  const totalEstimate = template.lines.reduce((sum, line) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.estimated_unit_price || '0') || 0;
    return sum + qty * price;
  }, 0);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all',
        'hover:border-primary-300 hover:bg-primary-50/50',
        isSelected
          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
          : 'border-neutral-200 bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title and badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-neutral-900 truncate">{template.name}</h4>
            <Badge variant="outline" className={cn('text-xs', priority.color)}>
              {priority.label}
            </Badge>
          </div>

          {/* Description */}
          {template.description && (
            <p className="text-sm text-neutral-500 line-clamp-2 mb-2">{template.description}</p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {departmentLabel}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {template.lines.length} items
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              Used {template.use_count}×
            </span>
          </div>
        </div>

        {/* Estimate and arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-700">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: template.currency,
              }).format(totalEstimate)}
            </p>
            <p className="text-xs text-neutral-400">est. total</p>
          </div>
          <ChevronRight
            className={cn(
              'h-5 w-5 transition-colors',
              isSelected ? 'text-primary-600' : 'text-neutral-300'
            )}
          />
        </div>
      </div>
    </motion.button>
  );
}

function TemplatePreview({ template }: { template: RequisitionTemplate }) {
  const departmentLabel =
    departmentOptions.find((d) => d.value === template.department)?.label || template.department;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-neutral-200">
        <h4 className="font-semibold text-neutral-900">{template.name}</h4>
        {template.description && (
          <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {template.created_by_name}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-neutral-500">Department:</span>
          <span className="ml-2 font-medium text-neutral-700">{departmentLabel}</span>
        </div>
        <div>
          <span className="text-neutral-500">Priority:</span>
          <span className="ml-2 font-medium text-neutral-700">
            {priorityConfig[template.priority].label}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">Currency:</span>
          <span className="ml-2 font-medium text-neutral-700">{template.currency}</span>
        </div>
        <div>
          <span className="text-neutral-500">Items:</span>
          <span className="ml-2 font-medium text-neutral-700">{template.lines.length}</span>
        </div>
      </div>

      {/* Line items preview */}
      <div>
        <h5 className="text-sm font-medium text-neutral-700 mb-2">Line Items</h5>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {template.lines.map((line, index) => (
            <div
              key={line.id}
              className="flex items-center justify-between p-2 bg-neutral-50 rounded text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-neutral-700 truncate">
                  {index + 1}. {line.description}
                </p>
                <p className="text-xs text-neutral-400">
                  {line.quantity} {line.unit_of_measure}
                  {line.notes && ` • ${line.notes}`}
                </p>
              </div>
              {line.estimated_unit_price && (
                <span className="text-neutral-600 flex-shrink-0 ml-2">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: template.currency,
                  }).format(parseFloat(line.estimated_unit_price))}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TemplateSelector({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = React.useState<RequisitionTemplate | null>(null);

  const { data: templates, isLoading, error } = useRequisitionTemplates();
  const incrementUseCount = useIncrementTemplateUseCount();

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery('');
      setDepartmentFilter('all');
      setSelectedTemplate(null);
    }
  }, [open]);

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    if (!templates) return [];

    let result = [...templates];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.lines.some((l) => l.description.toLowerCase().includes(query))
      );
    }

    // Department filter
    if (departmentFilter && departmentFilter !== 'all') {
      result = result.filter((t) => t.department === departmentFilter);
    }

    return result;
  }, [templates, searchQuery, departmentFilter]);

  const handleSelectAndApply = () => {
    if (selectedTemplate) {
      // Increment use count (fire and forget)
      incrementUseCount.mutate(selectedTemplate.id);
      onSelectTemplate(selectedTemplate);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            Select Template
          </DialogTitle>
          <DialogDescription>
            Start from a pre-configured template to save time. Templates include common items and
            settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 mt-4">
          {/* Left panel - Template list */}
          <div className="flex-1 min-w-0">
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOptions.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template list */}
            <ScrollArea className="h-[400px] pr-2">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border rounded-lg space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
                  <p className="text-sm text-red-600">Failed to load templates</p>
                  <p className="text-xs text-neutral-500 mt-1">Please try again later</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-neutral-300 mb-3" />
                  <p className="text-sm text-neutral-600">No templates found</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {searchQuery || departmentFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Create your first template by saving a requisition'}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={() => setSelectedTemplate(template)}
                        isSelected={selectedTemplate?.id === template.id}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </ScrollArea>
          </div>

          {/* Right panel - Preview */}
          <div className="w-80 flex-shrink-0 border-l pl-6">
            <h4 className="text-sm font-medium text-neutral-500 mb-3">Preview</h4>
            {selectedTemplate ? (
              <motion.div
                key={selectedTemplate.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <TemplatePreview template={selectedTemplate} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-12 w-12 text-neutral-200 mb-3" />
                <p className="text-sm text-neutral-500">Select a template to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <p className="text-sm text-neutral-500">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 && 's'} available
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSelectAndApply} disabled={!selectedTemplate}>
              Use Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

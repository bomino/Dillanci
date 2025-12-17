import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { unitOfMeasureOptions } from '@/lib/api/requisitions';

export interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_of_measure: string;
  estimated_unit_price: string;
  notes: string;
}

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

// Generate a unique ID for new line items
const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function LineItemsTable({
  items,
  onChange,
  disabled = false,
  errors = {},
}: LineItemsTableProps) {
  // Add a new blank line item
  const handleAddItem = () => {
    const newItem: LineItem = {
      id: generateId(),
      description: '',
      quantity: '1',
      unit_of_measure: 'EA',
      estimated_unit_price: '',
      notes: '',
    };
    onChange([...items, newItem]);
  };

  // Remove a line item
  const handleRemoveItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  // Update a single field on a line item
  const handleUpdateItem = (id: string, field: keyof LineItem, value: string) => {
    onChange(
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Calculate line total
  const calculateLineTotal = (item: LineItem): number => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.estimated_unit_price) || 0;
    return qty * price;
  };

  // Calculate grand total
  const grandTotal = items.reduce((sum, item) => sum + calculateLineTotal(item), 0);

  // Format currency
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>Add the items you need to request</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-neutral-200 rounded-lg">
            <p className="text-neutral-500 mb-3">No items added yet</p>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Item
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 text-sm font-medium text-neutral-500 pb-2 border-b">
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-1">UoM</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>

            {/* Line Items */}
            {items.map((item, index) => {
              const lineTotal = calculateLineTotal(item);
              const hasError = errors[`lines.${index}`];

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${hasError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-neutral-500">
                        Item {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={disabled}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 mb-1 block">Description *</label>
                      <Input
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        disabled={disabled}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">Qty *</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                          disabled={disabled}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">UoM</label>
                        <Select
                          value={item.unit_of_measure}
                          onValueChange={(value) => handleUpdateItem(item.id, 'unit_of_measure', value)}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {unitOfMeasureOptions.map(uom => (
                              <SelectItem key={uom.value} value={uom.value}>
                                {uom.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">Unit Price</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.estimated_unit_price}
                          onChange={(e) => handleUpdateItem(item.id, 'estimated_unit_price', e.target.value)}
                          placeholder="0.00"
                          disabled={disabled}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 mb-1 block">Notes</label>
                      <Input
                        value={item.notes}
                        onChange={(e) => handleUpdateItem(item.id, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        disabled={disabled}
                      />
                    </div>
                    <div className="flex justify-end pt-2 border-t">
                      <span className="text-sm font-medium">
                        Line Total: {formatAmount(lineTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 items-start">
                    <div className="col-span-4">
                      <Input
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        disabled={disabled}
                      />
                      <Input
                        value={item.notes}
                        onChange={(e) => handleUpdateItem(item.id, 'notes', e.target.value)}
                        placeholder="Notes (optional)"
                        disabled={disabled}
                        className="mt-2 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                        placeholder="Qty"
                        disabled={disabled}
                      />
                    </div>
                    <div className="col-span-1">
                      <Select
                        value={item.unit_of_measure}
                        onValueChange={(value) => handleUpdateItem(item.id, 'unit_of_measure', value)}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOfMeasureOptions.map(uom => (
                            <SelectItem key={uom.value} value={uom.value}>
                              {uom.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.estimated_unit_price}
                          onChange={(e) => handleUpdateItem(item.id, 'estimated_unit_price', e.target.value)}
                          placeholder="0.00"
                          disabled={disabled}
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-medium text-neutral-900">
                        {formatAmount(lineTotal)}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={disabled}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Error message */}
                  {hasError && (
                    <p className="text-sm text-red-600 mt-2">{errors[`lines.${index}`]}</p>
                  )}
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <span className="text-sm text-neutral-500 mr-4">Grand Total:</span>
                <span className="text-xl font-semibold text-neutral-900">
                  {formatAmount(grandTotal)}
                </span>
              </div>
            </div>

            {/* Add more button */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Item
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

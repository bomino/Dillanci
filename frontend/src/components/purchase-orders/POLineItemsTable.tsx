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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface POLineItem {
  id: string;
  description: string;
  quantity: string;
  unit_of_measure: string;
  unit_price: string;
}

interface POLineItemsTableProps {
  items: POLineItem[];
  onChange: (items: POLineItem[]) => void;
  readOnly?: boolean;
  showReceived?: boolean;
  receivedQuantities?: Record<string, string>;
}

const UNITS_OF_MEASURE = [
  { value: 'EA', label: 'Each' },
  { value: 'BX', label: 'Box' },
  { value: 'CS', label: 'Case' },
  { value: 'KT', label: 'Kit' },
  { value: 'PK', label: 'Pack' },
  { value: 'SET', label: 'Set' },
  { value: 'LF', label: 'Linear Foot' },
  { value: 'SF', label: 'Square Foot' },
  { value: 'HR', label: 'Hour' },
  { value: 'MO', label: 'Month' },
];

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

export default function POLineItemsTable({
  items,
  onChange,
  readOnly = false,
  showReceived = false,
  receivedQuantities = {},
}: POLineItemsTableProps) {
  const addItem = () => {
    const newItem: POLineItem = {
      id: `new-${Date.now()}`,
      description: '',
      quantity: '1',
      unit_of_measure: 'EA',
      unit_price: '0.00',
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof POLineItem, value: string) => {
    onChange(
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    onChange(items.filter(item => item.id !== id));
  };

  const calculateExtended = (quantity: string, unitPrice: string): number => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  };

  const calculateTotal = (): number => {
    return items.reduce((sum, item) => {
      return sum + calculateExtended(item.quantity, item.unit_price);
    }, 0);
  };

  if (readOnly) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px] text-right">Qty</TableHead>
              <TableHead className="w-[80px]">UoM</TableHead>
              <TableHead className="w-[120px] text-right">Unit Price</TableHead>
              <TableHead className="w-[120px] text-right">Extended</TableHead>
              {showReceived && (
                <TableHead className="w-[100px] text-right">Received</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const extended = calculateExtended(item.quantity, item.unit_price);
              const received = receivedQuantities[item.id] || '0';
              const qty = parseFloat(item.quantity) || 0;
              const rcv = parseFloat(received) || 0;
              const isFullyReceived = rcv >= qty;
              const isPartiallyReceived = rcv > 0 && rcv < qty;

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-neutral-500">
                    {index + 1}
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit_of_measure}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(extended)}
                  </TableCell>
                  {showReceived && (
                    <TableCell className="text-right">
                      <span
                        className={`${
                          isFullyReceived
                            ? 'text-green-600'
                            : isPartiallyReceived
                            ? 'text-amber-600'
                            : 'text-neutral-500'
                        }`}
                      >
                        {received} / {item.quantity}
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            <TableRow className="bg-neutral-50">
              <TableCell colSpan={showReceived ? 5 : 4} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-bold text-lg">
                {formatCurrency(calculateTotal())}
              </TableCell>
              {showReceived && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Qty</TableHead>
              <TableHead className="w-[120px]">UoM</TableHead>
              <TableHead className="w-[130px]">Unit Price</TableHead>
              <TableHead className="w-[120px] text-right">Extended</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-neutral-500">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                    className="min-w-[200px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={item.unit_of_measure}
                    onValueChange={value => updateItem(item.id, 'unit_of_measure', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS_OF_MEASURE.map(uom => (
                        <SelectItem key={uom.value} value={uom.value}>
                          {uom.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={e => updateItem(item.id, 'unit_price', e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(calculateExtended(item.quantity, item.unit_price))}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length <= 1}
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-neutral-50">
              <TableCell colSpan={5} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-bold text-lg">
                {formatCurrency(calculateTotal())}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">Item {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1}
                className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-neutral-600">Description</label>
              <Input
                value={item.description}
                onChange={e => updateItem(item.id, 'description', e.target.value)}
                placeholder="Item description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-neutral-600">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-600">Unit of Measure</label>
                <Select
                  value={item.unit_of_measure}
                  onValueChange={value => updateItem(item.id, 'unit_of_measure', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_OF_MEASURE.map(uom => (
                      <SelectItem key={uom.value} value={uom.value}>
                        {uom.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-neutral-600">Unit Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={e => updateItem(item.id, 'unit_price', e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-600">Extended</label>
                <div className="h-10 flex items-center font-medium text-neutral-900">
                  {formatCurrency(calculateExtended(item.quantity, item.unit_price))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Mobile Total */}
        <div className="rounded-lg border bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-700">Total</span>
            <span className="text-xl font-bold text-neutral-900">
              {formatCurrency(calculateTotal())}
            </span>
          </div>
        </div>
      </div>

      {/* Add Item Button */}
      <Button type="button" variant="outline" onClick={addItem} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Line Item
      </Button>
    </div>
  );
}

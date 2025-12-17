import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShoppingCart,
  Package,
  FileText,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ThreeWayMatchData, InvoiceLine, MatchStatus } from '@/types';
import { MATCH_STATUS_CONFIG } from '@/lib/api/invoices';

interface ThreeWayMatchProps {
  matchData?: ThreeWayMatchData[];
  lines?: InvoiceLine[];
}

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatNumber = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US');
};

const MatchStatusIcon = ({ status }: { status: MatchStatus }) => {
  switch (status) {
    case 'MATCHED':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'PARTIAL':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'VARIANCE':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'UNMATCHED':
    default:
      return <AlertTriangle className="h-5 w-5 text-neutral-400" />;
  }
};

const MatchStatusBadge = ({ status }: { status: MatchStatus }) => {
  const config = MATCH_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      <MatchStatusIcon status={status} />
      {config.label}
    </span>
  );
};

export default function ThreeWayMatch({ matchData, lines }: ThreeWayMatchProps) {
  if (!matchData || matchData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              <ArrowRight className="h-3 w-3 text-neutral-400" />
              <Package className="h-4 w-4" />
              <ArrowRight className="h-3 w-3 text-neutral-400" />
              <FileText className="h-4 w-4" />
            </div>
            3-Way Match
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-neutral-300" />
            <p className="mt-4 text-neutral-500">
              No match data available. The invoice needs to be matched against the PO and Goods Receipt.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall match status
  const overallStatus = matchData.every(m => m.match_status === 'MATCHED')
    ? 'MATCHED'
    : matchData.some(m => m.match_status === 'VARIANCE')
    ? 'VARIANCE'
    : 'PARTIAL';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <ArrowRight className="h-3 w-3 text-neutral-400" />
                <Package className="h-4 w-4 text-cyan-600" />
                <ArrowRight className="h-3 w-3 text-neutral-400" />
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
              3-Way Match
            </CardTitle>
            <MatchStatusBadge status={overallStatus} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Visual Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <ShoppingCart className="mx-auto h-8 w-8 text-blue-600 mb-2" />
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Purchase Order</p>
              <p className="text-lg font-semibold text-blue-900 mt-1">
                {formatCurrency(
                  matchData.reduce((sum, m) => sum + parseFloat(m.po_amount), 0)
                )}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-cyan-50 border border-cyan-200">
              <Package className="mx-auto h-8 w-8 text-cyan-600 mb-2" />
              <p className="text-xs font-medium text-cyan-700 uppercase tracking-wide">Goods Receipt</p>
              <p className="text-lg font-semibold text-cyan-900 mt-1">
                {formatNumber(
                  matchData.reduce((sum, m) => sum + parseFloat(m.gr_quantity), 0)
                )} units
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
              <FileText className="mx-auto h-8 w-8 text-purple-600 mb-2" />
              <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Invoice</p>
              <p className="text-lg font-semibold text-purple-900 mt-1">
                {formatCurrency(
                  matchData.reduce((sum, m) => sum + parseFloat(m.invoice_amount), 0)
                )}
              </p>
            </div>
          </div>

          {/* Detailed Comparison Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50">
                  <TableHead rowSpan={2} className="align-bottom border-r">Line</TableHead>
                  <TableHead colSpan={3} className="text-center border-r bg-blue-50 text-blue-800">
                    Purchase Order
                  </TableHead>
                  <TableHead className="text-center border-r bg-cyan-50 text-cyan-800">
                    Goods Receipt
                  </TableHead>
                  <TableHead colSpan={3} className="text-center border-r bg-purple-50 text-purple-800">
                    Invoice
                  </TableHead>
                  <TableHead colSpan={3} className="text-center bg-neutral-100">
                    Variance
                  </TableHead>
                  <TableHead rowSpan={2} className="text-center align-bottom">Status</TableHead>
                </TableRow>
                <TableRow className="bg-neutral-50">
                  <TableHead className="text-right text-xs bg-blue-50">Qty</TableHead>
                  <TableHead className="text-right text-xs bg-blue-50">Price</TableHead>
                  <TableHead className="text-right text-xs border-r bg-blue-50">Amount</TableHead>
                  <TableHead className="text-right text-xs border-r bg-cyan-50">Qty</TableHead>
                  <TableHead className="text-right text-xs bg-purple-50">Qty</TableHead>
                  <TableHead className="text-right text-xs bg-purple-50">Price</TableHead>
                  <TableHead className="text-right text-xs border-r bg-purple-50">Amount</TableHead>
                  <TableHead className="text-right text-xs">Qty</TableHead>
                  <TableHead className="text-right text-xs">Price</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchData.map((match, index) => {
                  const line = lines?.[index];
                  const hasQuantityVariance = parseFloat(match.quantity_variance) !== 0;
                  const hasPriceVariance = parseFloat(match.price_variance) !== 0;
                  const hasAmountVariance = parseFloat(match.amount_variance) !== 0;

                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium border-r">
                        <div className="max-w-[150px]">
                          <span className="text-neutral-500">#{index + 1}</span>
                          {line && (
                            <p className="text-xs text-neutral-500 truncate mt-1">
                              {line.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      {/* PO */}
                      <TableCell className="text-right">{formatNumber(match.po_quantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(match.po_unit_price)}</TableCell>
                      <TableCell className="text-right font-medium border-r">
                        {formatCurrency(match.po_amount)}
                      </TableCell>
                      {/* GR */}
                      <TableCell className="text-right border-r">{formatNumber(match.gr_quantity)}</TableCell>
                      {/* Invoice */}
                      <TableCell className="text-right">{formatNumber(match.invoice_quantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(match.invoice_unit_price)}</TableCell>
                      <TableCell className="text-right font-medium border-r">
                        {formatCurrency(match.invoice_amount)}
                      </TableCell>
                      {/* Variance */}
                      <TableCell className={`text-right ${hasQuantityVariance ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                        {hasQuantityVariance ? match.quantity_variance : '-'}
                      </TableCell>
                      <TableCell className={`text-right ${hasPriceVariance ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                        {hasPriceVariance ? formatCurrency(match.price_variance) : '-'}
                      </TableCell>
                      <TableCell className={`text-right ${hasAmountVariance ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                        {hasAmountVariance ? formatCurrency(match.amount_variance) : '-'}
                      </TableCell>
                      {/* Status */}
                      <TableCell className="text-center">
                        <MatchStatusIcon status={match.match_status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-neutral-50 font-semibold">
                  <TableCell className="border-r">Total</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(matchData.reduce((sum, m) => sum + parseFloat(m.po_quantity), 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right border-r">
                    {formatCurrency(matchData.reduce((sum, m) => sum + parseFloat(m.po_amount), 0))}
                  </TableCell>
                  <TableCell className="text-right border-r">
                    {formatNumber(matchData.reduce((sum, m) => sum + parseFloat(m.gr_quantity), 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(matchData.reduce((sum, m) => sum + parseFloat(m.invoice_quantity), 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right border-r">
                    {formatCurrency(matchData.reduce((sum, m) => sum + parseFloat(m.invoice_amount), 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(matchData.reduce((sum, m) => sum + parseFloat(m.quantity_variance), 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(matchData.reduce((sum, m) => sum + parseFloat(m.amount_variance), 0))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
            <span className="text-neutral-500">Legend:</span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Matched
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Partial Match
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              Variance
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ClipboardList,
  Filter,
  Download,
  FileEdit,
  Trash2,
  Plus,
  Eye,
  RefreshCw,
  Clock,
} from 'lucide-react';
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
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuditLogs } from '@/lib/api/admin';
import type { AuditLog } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const actionConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  CREATE: { label: 'Created', color: 'text-green-700', bgColor: 'bg-green-100', icon: <Plus className="h-3 w-3" /> },
  UPDATE: { label: 'Updated', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <FileEdit className="h-3 w-3" /> },
  DELETE: { label: 'Deleted', color: 'text-red-700', bgColor: 'bg-red-100', icon: <Trash2 className="h-3 w-3" /> },
  VIEW: { label: 'Viewed', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: <Eye className="h-3 w-3" /> },
  STATUS_CHANGE: { label: 'Status', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: <RefreshCw className="h-3 w-3" /> },
};

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getModelName(contentType: string): string {
  const parts = contentType.split('.');
  const model = parts[parts.length - 1];
  return model.charAt(0).toUpperCase() + model.slice(1).replace(/_/g, ' ');
}

interface ChangesDiffProps {
  changes: Record<string, { old: unknown; new: unknown }>;
}

function ChangesDiff({ changes }: ChangesDiffProps) {
  if (!changes || Object.keys(changes).length === 0) {
    return <p className="text-sm text-neutral-500">No field changes recorded</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
        <div key={field} className="border rounded-lg p-3 bg-neutral-50">
          <p className="text-sm font-medium text-neutral-700 mb-2 capitalize">
            {field.replace(/_/g, ' ')}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-red-600 mb-1">Previous</p>
              <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-sm font-mono text-red-800 break-all">
                {oldVal === null || oldVal === undefined ? (
                  <span className="text-neutral-400 italic">empty</span>
                ) : (
                  String(oldVal)
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-green-600 mb-1">New</p>
              <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-sm font-mono text-green-800 break-all">
                {newVal === null || newVal === undefined ? (
                  <span className="text-neutral-400 italic">empty</span>
                ) : (
                  String(newVal)
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const params: Record<string, string> = {};
  if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;
  if (search) params.search = search;

  const { data: logsData, isLoading, refetch } = useAuditLogs(params);

  const handleExport = () => {
    if (!logsData?.results) return;

    const headers = ['Timestamp', 'User', 'Action', 'Object Type', 'Object', 'Changes'];
    const rows = logsData.results.map((log) => [
      formatFullTimestamp(log.timestamp),
      log.user_email,
      log.action_display || log.action,
      log.content_type_name,
      log.object_repr,
      log.changes ? JSON.stringify(log.changes) : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'timestamp',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <div>
            <div className="text-sm font-medium">{formatTimestamp(row.original.timestamp)}</div>
            <div className="text-xs text-neutral-500">
              {new Date(row.original.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'user_email',
      header: 'User',
      cell: ({ row }) => {
        const email = row.original.user_email || 'Unknown';
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
              {email[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-sm">{email}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => {
        const config = actionConfig[row.original.action] || {
          label: row.original.action_display || row.original.action,
          color: 'text-neutral-700',
          bgColor: 'bg-neutral-100',
          icon: <FileEdit className="h-3 w-3" />,
        };
        return (
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bgColor, config.color)}>
            {config.icon}
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'content_type_name',
      header: 'Object Type',
      cell: ({ row }) => (
        <span className="text-sm text-neutral-600">
          {getModelName(row.original.content_type_name)}
        </span>
      ),
    },
    {
      accessorKey: 'object_repr',
      header: 'Object',
      cell: ({ row }) => (
        <div className="max-w-xs truncate">
          <span className="text-sm font-medium text-neutral-900">{row.original.object_repr}</span>
          {row.original.from_state && row.original.to_state && (
            <div className="text-xs text-neutral-500 mt-0.5">
              {row.original.from_state} → {row.original.to_state}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'changes_summary',
      header: 'Changes',
      cell: ({ row }) => {
        const changes = row.original.changes;
        if (!changes || Object.keys(changes).length === 0) {
          return <span className="text-xs text-neutral-400">-</span>;
        }
        return (
          <span className="text-xs text-neutral-500">
            {Object.keys(changes).length} field(s)
          </span>
        );
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Audit Logs</h1>
            <p className="text-neutral-500">Track all system activity and changes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!logsData?.results?.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search by user email or object..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Created</SelectItem>
                <SelectItem value="UPDATE">Updated</SelectItem>
                <SelectItem value="DELETE">Deleted</SelectItem>
                <SelectItem value="VIEW">Viewed</SelectItem>
                <SelectItem value="STATUS_CHANGE">Status Change</SelectItem>
              </SelectContent>
            </Select>
            <div>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="From date"
              />
            </div>
            <div>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="To date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {logsData?.count !== undefined ? `${logsData.count} entries` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={logsData?.results || []}
            loading={isLoading}
            onRowClick={(row) => setSelectedLog(row.original)}
            emptyState={{
              title: 'No audit logs found',
              description: 'Try adjusting your filters or date range',
            }}
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              Audit Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6 mt-4">
              {/* Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-neutral-500">Timestamp</label>
                  <p className="text-neutral-900 font-medium">
                    {formatFullTimestamp(selectedLog.timestamp)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">User</label>
                  <p className="text-neutral-900 font-medium">{selectedLog.user_email}</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Action</label>
                  <div className="mt-1">
                    {(() => {
                      const config = actionConfig[selectedLog.action] || {
                        label: selectedLog.action_display || selectedLog.action,
                        color: 'text-neutral-700',
                        bgColor: 'bg-neutral-100',
                        icon: <FileEdit className="h-3 w-3" />,
                      };
                      return (
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bgColor, config.color)}>
                          {config.icon}
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Object Type</label>
                  <p className="text-neutral-900 font-medium">
                    {getModelName(selectedLog.content_type_name)}
                  </p>
                </div>
              </div>

              {/* Object Info */}
              <div className="border rounded-lg p-4 bg-neutral-50">
                <label className="text-sm text-neutral-500">Object</label>
                <p className="text-neutral-900 font-medium">{selectedLog.object_repr}</p>
                <p className="text-xs text-neutral-400 font-mono mt-1">ID: {selectedLog.object_id}</p>
              </div>

              {/* Status Change */}
              {selectedLog.from_state && selectedLog.to_state && (
                <div className="border rounded-lg p-4">
                  <label className="text-sm text-neutral-500 block mb-2">Status Change</label>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={selectedLog.from_state}>{selectedLog.from_state}</StatusBadge>
                    <span className="text-neutral-400">→</span>
                    <StatusBadge status={selectedLog.to_state}>{selectedLog.to_state}</StatusBadge>
                  </div>
                </div>
              )}

              {/* Field Changes */}
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <label className="text-sm text-neutral-500 block mb-3">Field Changes</label>
                  <ChangesDiff changes={selectedLog.changes} />
                </div>
              )}

              {/* Extra Data */}
              {selectedLog.extra_data && Object.keys(selectedLog.extra_data).length > 0 && (
                <div>
                  <label className="text-sm text-neutral-500 block mb-2">Additional Data</label>
                  <pre className="bg-neutral-900 text-neutral-100 rounded-lg p-4 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.extra_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Request Info */}
              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-neutral-500">IP Address</label>
                  <p className="text-neutral-900 font-mono">{selectedLog.ip_address || '-'}</p>
                </div>
                <div>
                  <label className="text-neutral-500">User Agent</label>
                  <p className="text-neutral-900 truncate" title={selectedLog.user_agent || ''}>
                    {selectedLog.user_agent || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

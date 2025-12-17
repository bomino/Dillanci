import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Paperclip,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from './button';
import { Skeleton } from './skeleton';
import { FileUpload } from './file-upload';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  formatFileSize,
  getFileIcon,
  type Attachment,
} from '@/lib/api/attachments';

interface AttachmentsSectionProps {
  objectType: string;
  objectId: string;
  acceptedTypes?: string[];
  maxFiles?: number;
  className?: string;
  readOnly?: boolean;
}

interface AttachmentItemProps {
  attachment: Attachment;
  currentUserId: string | undefined;
  onDelete: (attachment: Attachment) => void;
  readOnly?: boolean;
}

function FileIcon({ type }: { type: string }) {
  const iconType = getFileIcon(type);

  const iconClass = 'h-5 w-5';

  switch (iconType) {
    case 'pdf':
      return <FileText className={cn(iconClass, 'text-red-500')} />;
    case 'image':
      return <FileImage className={cn(iconClass, 'text-blue-500')} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={cn(iconClass, 'text-green-500')} />;
    case 'document':
      return <FileText className={cn(iconClass, 'text-primary-500')} />;
    default:
      return <File className={cn(iconClass, 'text-neutral-400')} />;
  }
}

function AttachmentItem({ attachment, currentUserId, onDelete, readOnly }: AttachmentItemProps) {
  const isOwner = currentUserId === attachment.uploaded_by.id;
  const uploaderName = `${attachment.uploaded_by.first_name} ${attachment.uploaded_by.last_name}`.trim() || attachment.uploaded_by.email;
  const timeAgo = formatDistanceToNow(new Date(attachment.uploaded_at), { addSuffix: true });

  const handleDownload = () => {
    // In production, this would be a real file URL
    // For mock mode, we'll just show an alert
    if (import.meta.env.VITE_MOCK_API === 'true') {
      alert(`Download: ${attachment.filename}`);
    } else {
      window.open(attachment.url, '_blank');
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 group hover:bg-neutral-100 transition-colors">
      {/* File icon */}
      <div className="flex-shrink-0">
        <FileIcon type={attachment.file_type} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate">
          {attachment.filename}
        </p>
        <p className="text-xs text-neutral-500">
          {formatFileSize(attachment.file_size)} • {uploaderName} • {timeAgo}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>

        {!readOnly && isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(attachment)}
                className="cursor-pointer text-error"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function AttachmentSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
      <Skeleton className="w-5 h-5 rounded" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export function AttachmentsSection({
  objectType,
  objectId,
  acceptedTypes,
  maxFiles = 10,
  className,
  readOnly = false,
}: AttachmentsSectionProps) {
  const { user } = useAuthStore();
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean; attachment: Attachment | null }>({
    open: false,
    attachment: null,
  });

  const { data: attachments, isLoading, error } = useAttachments(objectType, objectId);
  const uploadMutation = useUploadAttachment();
  const deleteMutation = useDeleteAttachment(objectType, objectId);

  const handleUpload = async (file: File) => {
    await uploadMutation.mutateAsync({
      file,
      object_type: objectType,
      object_id: objectId,
    });
  };

  const handleDelete = (attachment: Attachment) => {
    setDeleteDialog({ open: true, attachment });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.attachment) return;

    await deleteMutation.mutateAsync(deleteDialog.attachment.id);
    setDeleteDialog({ open: false, attachment: null });
  };

  const canUpload = !readOnly && (!attachments || attachments.length < maxFiles);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-neutral-500">
        <Paperclip className="h-4 w-4" />
        <span className="text-sm font-medium">
          {attachments?.length || 0} attachment{attachments?.length !== 1 ? 's' : ''}
        </span>
        {maxFiles && attachments && (
          <span className="text-xs text-neutral-400">
            ({maxFiles - attachments.length} remaining)
          </span>
        )}
      </div>

      {/* Upload area */}
      {canUpload && (
        <FileUpload
          onUpload={handleUpload}
          acceptedTypes={acceptedTypes}
          disabled={uploadMutation.isPending}
        />
      )}

      {/* Attachments List */}
      <div className="space-y-2">
        {isLoading ? (
          <>
            <AttachmentSkeleton />
            <AttachmentSkeleton />
          </>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-error">Failed to load attachments</p>
          </div>
        ) : attachments && attachments.length > 0 ? (
          attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              currentUserId={user?.id}
              onDelete={handleDelete}
              readOnly={readOnly}
            />
          ))
        ) : (
          <div className="py-6 text-center">
            <Paperclip className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No attachments</p>
            {canUpload && (
              <p className="text-xs text-neutral-400">Upload files to attach them to this record</p>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, attachment: open ? deleteDialog.attachment : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.attachment?.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-error hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AttachmentsSection;

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Edit2, Trash2, Loader2, MoreHorizontal } from 'lucide-react';
import { Button } from './button';
import { Textarea } from './textarea';
import { Skeleton } from './skeleton';
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
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  type Comment,
} from '@/lib/api/comments';

interface CommentsSectionProps {
  objectType: string;
  objectId: string;
  className?: string;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string | undefined;
  onEdit: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

function CommentItem({ comment, currentUserId, onEdit, onDelete }: CommentItemProps) {
  const isOwner = currentUserId === comment.author.id;
  const initials = `${comment.author.first_name?.[0] || ''}${comment.author.last_name?.[0] || ''}`.toUpperCase() || comment.author.email[0].toUpperCase();
  const authorName = `${comment.author.first_name} ${comment.author.last_name}`.trim() || comment.author.email;
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const wasEdited = comment.created_at !== comment.updated_at;

  return (
    <div className="flex gap-3 py-3">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
        <span className="text-xs font-medium text-primary-700">{initials}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-neutral-900 truncate">
              {authorName}
            </span>
            <span className="text-xs text-neutral-400">
              {timeAgo}
              {wasEdited && ' (edited)'}
            </span>
          </div>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(comment)} className="cursor-pointer">
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(comment)}
                  className="cursor-pointer text-error"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <p className="mt-1 text-sm text-neutral-600 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function CommentsSection({ objectType, objectId, className }: CommentsSectionProps) {
  const { user } = useAuthStore();
  const [newComment, setNewComment] = React.useState('');
  const [editingComment, setEditingComment] = React.useState<Comment | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean; comment: Comment | null }>({
    open: false,
    comment: null,
  });

  const { data: comments, isLoading, error } = useComments(objectType, objectId);
  const createMutation = useCreateComment();
  const updateMutation = useUpdateComment(objectType, objectId);
  const deleteMutation = useDeleteComment(objectType, objectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await createMutation.mutateAsync({
      content: newComment.trim(),
      object_type: objectType,
      object_id: objectId,
    });
    setNewComment('');
  };

  const handleEdit = (comment: Comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editingComment || !editContent.trim()) return;

    await updateMutation.mutateAsync({
      id: editingComment.id,
      data: { content: editContent.trim() },
    });
    setEditingComment(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const handleDelete = (comment: Comment) => {
    setDeleteDialog({ open: true, comment });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.comment) return;

    await deleteMutation.mutateAsync(deleteDialog.comment.id);
    setDeleteDialog({ open: false, comment: null });
  };

  // Sort comments by created_at (oldest first for conversation flow)
  const sortedComments = React.useMemo(() => {
    if (!comments) return [];
    return [...comments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [comments]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-neutral-500">
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">
          {comments?.length || 0} comment{comments?.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Comments List */}
      <div className="divide-y divide-neutral-100">
        {isLoading ? (
          <>
            <CommentSkeleton />
            <CommentSkeleton />
          </>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-error">Failed to load comments</p>
          </div>
        ) : sortedComments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No comments yet</p>
            <p className="text-xs text-neutral-400">Be the first to add a comment</p>
          </div>
        ) : (
          sortedComments.map((comment) => (
            <div key={comment.id} className="group">
              {editingComment?.id === comment.id ? (
                <div className="py-3 space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[80px] text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending || !editContent.trim()}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <CommentItem
                  comment={comment}
                  currentUserId={user?.id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-xs font-medium text-primary-700">
            {user?.first_name?.[0] || user?.email?.[0] || '?'}
          </span>
        </div>
        <div className="flex-1 flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[40px] resize-none text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim() || createMutation.isPending}
            className="flex-shrink-0"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, comment: open ? deleteDialog.comment : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
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

export default CommentsSection;

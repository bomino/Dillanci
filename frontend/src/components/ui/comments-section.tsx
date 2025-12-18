import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Loader2,
  MoreHorizontal,
  Reply,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
  buildCommentTree,
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
  objectType: string;
  objectId: string;
  onEdit: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
  onReply: (comment: Comment) => void;
  replyingTo: Comment | null;
  onCancelReply: () => void;
  onSubmitReply: (content: string, parentId: string) => Promise<void>;
  isSubmittingReply: boolean;
  depth?: number;
}

interface ReplyFormProps {
  parentComment: Comment;
  onSubmit: (content: string, parentId: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function ReplyForm({ parentComment, onSubmit, onCancel, isSubmitting }: ReplyFormProps) {
  const [content, setContent] = React.useState('');
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onSubmit(content.trim(), parentComment.id);
    setContent('');
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="mt-2 ml-11 pl-4 border-l-2 border-primary-100"
    >
      <div className="flex gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-[10px] font-medium text-primary-700">
            {user?.first_name?.[0] || user?.email?.[0] || '?'}
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Reply to ${parentComment.author.first_name}...`}
            className="min-h-[60px] resize-none text-sm"
            rows={2}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
              if (e.key === 'Escape') {
                onCancel();
              }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.form>
  );
}

function CommentItem({
  comment,
  currentUserId,
  objectType,
  objectId,
  onEdit,
  onDelete,
  onReply,
  replyingTo,
  onCancelReply,
  onSubmitReply,
  isSubmittingReply,
  depth = 0,
}: CommentItemProps) {
  const [showReplies, setShowReplies] = React.useState(true);
  const isOwner = currentUserId === comment.author.id;
  const initials = `${comment.author.first_name?.[0] || ''}${comment.author.last_name?.[0] || ''}`.toUpperCase() || comment.author.email[0].toUpperCase();
  const authorName = `${comment.author.first_name} ${comment.author.last_name}`.trim() || comment.author.email;
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const wasEdited = comment.created_at !== comment.updated_at;
  const hasReplies = comment.replies && comment.replies.length > 0;
  const isReplyingToThis = replyingTo?.id === comment.id;
  const maxDepth = 3;

  return (
    <div className={cn('group', depth > 0 && 'ml-11 pl-4 border-l-2 border-neutral-100')}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className={cn(
          'flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center',
          depth > 0 ? 'w-6 h-6' : 'w-8 h-8'
        )}>
          <span className={cn(
            'font-medium text-primary-700',
            depth > 0 ? 'text-[10px]' : 'text-xs'
          )}>
            {initials}
          </span>
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

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Reply button - only show if not at max depth */}
              {depth < maxDepth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-neutral-500 hover:text-neutral-700"
                  onClick={() => onReply(comment)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  <span className="text-xs">Reply</span>
                </Button>
              )}

              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
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
          </div>

          <p className="mt-1 text-sm text-neutral-600 whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Toggle replies button */}
          {hasReplies && (
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              {showReplies ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Reply form for this comment */}
      <AnimatePresence>
        {isReplyingToThis && (
          <ReplyForm
            parentComment={comment}
            onSubmit={onSubmitReply}
            onCancel={onCancelReply}
            isSubmitting={isSubmittingReply}
          />
        )}
      </AnimatePresence>

      {/* Nested replies */}
      <AnimatePresence>
        {hasReplies && showReplies && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {comment.replies!.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                objectType={objectType}
                objectId={objectId}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                replyingTo={replyingTo}
                onCancelReply={onCancelReply}
                onSubmitReply={onSubmitReply}
                isSubmittingReply={isSubmittingReply}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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
  const [replyingTo, setReplyingTo] = React.useState<Comment | null>(null);
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

  const handleSubmitReply = async (content: string, parentId: string) => {
    await createMutation.mutateAsync({
      content,
      object_type: objectType,
      object_id: objectId,
      parent_id: parentId,
    });
    setReplyingTo(null);
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

  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  // Build threaded comment tree and sort root comments
  const threadedComments = React.useMemo(() => {
    if (!comments) return [];
    const tree = buildCommentTree(comments);
    return tree.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [comments]);

  // Count total comments including replies
  const totalCount = comments?.length || 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-neutral-500">
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">
          {totalCount} comment{totalCount !== 1 ? 's' : ''}
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
        ) : threadedComments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No comments yet</p>
            <p className="text-xs text-neutral-400">Be the first to add a comment</p>
          </div>
        ) : (
          threadedComments.map((comment) => (
            <div key={comment.id}>
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
                  objectType={objectType}
                  objectId={objectId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  replyingTo={replyingTo}
                  onCancelReply={handleCancelReply}
                  onSubmitReply={handleSubmitReply}
                  isSubmittingReply={createMutation.isPending}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-neutral-100">
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
              {deleteDialog.comment?.replies && deleteDialog.comment.replies.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  Note: This comment has {deleteDialog.comment.replies.length} {deleteDialog.comment.replies.length === 1 ? 'reply' : 'replies'} that will also be deleted.
                </span>
              )}
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

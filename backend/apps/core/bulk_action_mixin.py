"""
Bulk action mixin for ViewSets.

Provides batch operations for approve, reject, and delete actions.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response


class BulkActionMixin:
    """
    Mixin to add bulk action functionality to ViewSets.

    Provides:
    - bulk_approve: Approve multiple items
    - bulk_reject: Reject multiple items
    - bulk_delete: Delete multiple items

    Subclasses should define:
    - bulk_approve_method: str - Name of method to call for approval (e.g., 'approve')
    - bulk_reject_method: str - Name of method to call for rejection (e.g., 'reject')
    - bulk_approvable_statuses: list - Statuses that can be approved
    - bulk_rejectable_statuses: list - Statuses that can be rejected
    - bulk_deletable_statuses: list - Statuses that can be deleted
    """

    bulk_approve_method = 'approve'
    bulk_reject_method = 'reject'
    bulk_approvable_statuses = []
    bulk_rejectable_statuses = []
    bulk_deletable_statuses = []

    def _get_bulk_ids(self, request):
        """Extract and validate IDs from request."""
        ids = request.data.get('ids', [])
        if not ids:
            return None, Response(
                {'error': 'No IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not isinstance(ids, list):
            return None, Response(
                {'error': 'IDs must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return ids, None

    @action(detail=False, methods=['post'], url_path='bulk-approve')
    def bulk_approve(self, request):
        """
        Approve multiple items at once.

        Request body:
        {
            "ids": ["uuid1", "uuid2", ...]
        }

        Returns:
        {
            "success": ["uuid1", "uuid2"],
            "failed": [{"id": "uuid3", "error": "Invalid status"}]
        }
        """
        ids, error_response = self._get_bulk_ids(request)
        if error_response:
            return error_response

        if not self.bulk_approvable_statuses:
            return Response(
                {'error': 'Bulk approve not configured for this resource'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(id__in=ids)
        success = []
        failed = []

        for obj in queryset:
            if obj.status not in self.bulk_approvable_statuses:
                failed.append({
                    'id': str(obj.id),
                    'error': f'Cannot approve item with status {obj.status}'
                })
                continue

            try:
                approve_method = getattr(obj, self.bulk_approve_method)
                # Some approve methods need user argument
                try:
                    approve_method(request.user)
                except TypeError:
                    approve_method()
                success.append(str(obj.id))
            except Exception as e:
                failed.append({
                    'id': str(obj.id),
                    'error': str(e)
                })

        return Response({
            'success': success,
            'failed': failed,
            'total_processed': len(success) + len(failed),
            'total_success': len(success),
            'total_failed': len(failed)
        })

    @action(detail=False, methods=['post'], url_path='bulk-reject')
    def bulk_reject(self, request):
        """
        Reject multiple items at once.

        Request body:
        {
            "ids": ["uuid1", "uuid2", ...],
            "reason": "Optional rejection reason"
        }

        Returns:
        {
            "success": ["uuid1", "uuid2"],
            "failed": [{"id": "uuid3", "error": "Invalid status"}]
        }
        """
        ids, error_response = self._get_bulk_ids(request)
        if error_response:
            return error_response

        if not self.bulk_rejectable_statuses:
            return Response(
                {'error': 'Bulk reject not configured for this resource'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', 'Bulk rejection')
        queryset = self.get_queryset().filter(id__in=ids)
        success = []
        failed = []

        for obj in queryset:
            if obj.status not in self.bulk_rejectable_statuses:
                failed.append({
                    'id': str(obj.id),
                    'error': f'Cannot reject item with status {obj.status}'
                })
                continue

            try:
                reject_method = getattr(obj, self.bulk_reject_method)
                # Try different signatures for reject
                try:
                    reject_method(request.user, reason)
                except TypeError:
                    try:
                        reject_method(reason)
                    except TypeError:
                        reject_method()
                success.append(str(obj.id))
            except Exception as e:
                failed.append({
                    'id': str(obj.id),
                    'error': str(e)
                })

        return Response({
            'success': success,
            'failed': failed,
            'total_processed': len(success) + len(failed),
            'total_success': len(success),
            'total_failed': len(failed)
        })

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        Delete multiple items at once.

        Request body:
        {
            "ids": ["uuid1", "uuid2", ...]
        }

        Returns:
        {
            "success": ["uuid1", "uuid2"],
            "failed": [{"id": "uuid3", "error": "Cannot delete"}]
        }
        """
        ids, error_response = self._get_bulk_ids(request)
        if error_response:
            return error_response

        if not self.bulk_deletable_statuses:
            return Response(
                {'error': 'Bulk delete not configured for this resource'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(id__in=ids)
        success = []
        failed = []

        for obj in queryset:
            if obj.status not in self.bulk_deletable_statuses:
                failed.append({
                    'id': str(obj.id),
                    'error': f'Cannot delete item with status {obj.status}'
                })
                continue

            try:
                obj.delete()
                success.append(str(obj.id))
            except Exception as e:
                failed.append({
                    'id': str(obj.id),
                    'error': str(e)
                })

        return Response({
            'success': success,
            'failed': failed,
            'total_processed': len(success) + len(failed),
            'total_success': len(success),
            'total_failed': len(failed)
        })

"""
Custom permissions for the Procurement Platform.
"""

from rest_framework import permissions


class IsOrganizationMember(permissions.BasePermission):
    """
    Permission to only allow access to objects within the user's organization.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the object has an organization field
        if hasattr(obj, 'organization'):
            return obj.organization == request.user.organization
        # Check if the object has an organization_id field
        if hasattr(obj, 'organization_id'):
            return obj.organization_id == request.user.organization_id
        return True


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed for any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        return True

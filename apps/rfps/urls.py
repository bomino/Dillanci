"""
URL configuration for RFP endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BAFORoundViewSet,
    EvaluationTeamViewSet,
    ProposalViewSet,
    RFPInvitationViewSet,
    RFPViewSet,
    ScoringCriteriaViewSet,
)

router = DefaultRouter()
# Register more specific patterns first
router.register(r'invitations', RFPInvitationViewSet, basename='rfp-invitation')
router.register(r'proposals', ProposalViewSet, basename='proposal')
router.register(r'bafo-rounds', BAFORoundViewSet, basename='bafo-round')
router.register(r'evaluators', EvaluationTeamViewSet, basename='evaluation-team')
router.register(r'criteria', ScoringCriteriaViewSet, basename='scoring-criteria')
# Root pattern last
router.register(r'', RFPViewSet, basename='rfp')

urlpatterns = [
    path('', include(router.urls)),
]

"""
RFP views and viewsets for API endpoints.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import (
    DuplicateInvitationError,
    InvalidStateTransitionError,
)

from .models import (
    BAFORound,
    BAFOResponse,
    EvaluationScore,
    EvaluationTeam,
    Proposal,
    ProposalLineItem,
    QuestionResponse,
    RFP,
    RFPInvitation,
    RFPLineItem,
    RFPQuestion,
    RFPSection,
    RFPQA,
    ScoringCriteria,
)
from .serializers import (
    AwardProposalSerializer,
    BAFORoundCreateSerializer,
    BAFORoundSerializer,
    BAFOResponseCreateSerializer,
    BAFOResponseSerializer,
    DeclineInvitationSerializer,
    DisqualifyProposalSerializer,
    EvaluationScoreCreateSerializer,
    EvaluationScoreSerializer,
    EvaluationTeamCreateSerializer,
    EvaluationTeamSerializer,
    IntentToBidSerializer,
    ProposalCreateSerializer,
    ProposalLineItemCreateSerializer,
    ProposalLineItemSerializer,
    ProposalListSerializer,
    ProposalSerializer,
    QuestionResponseCreateSerializer,
    QuestionResponseSerializer,
    RFPCreateSerializer,
    RFPInvitationCreateSerializer,
    RFPInvitationSerializer,
    RFPLineItemCreateSerializer,
    RFPLineItemSerializer,
    RFPListSerializer,
    RFPQAAnswerSerializer,
    RFPQACreateSerializer,
    RFPQASerializer,
    RFPQuestionCreateSerializer,
    RFPQuestionSerializer,
    RFPSectionCreateSerializer,
    RFPSectionSerializer,
    RFPSerializer,
    ScoringCriteriaCreateSerializer,
    ScoringCriteriaSerializer,
    ShortlistProposalSerializer,
)
from .services import RFPNotificationService, ScoringService


class RFPViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RFP management with workflow actions.

    Workflow actions:
    - publish: DRAFT -> PUBLISHED
    - start_evaluation: PUBLISHED -> EVALUATION
    - start_bafo_round: EVALUATION -> BAFO
    - close_bafo_round: BAFO -> EVALUATION
    - close_evaluation: EVALUATION/BAFO -> CLOSED
    - award: CLOSED -> AWARDED
    - cancel: Any (except AWARDED) -> CANCELLED
    """

    queryset = RFP.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        'status', 'organization', 'created_by', 'rfp_type',
        'visibility', 'bidding_type', 'awarded_supplier',
    ]
    search_fields = ['number', 'title', 'description']
    ordering_fields = [
        'number', 'title', 'created_at', 'status', 'response_deadline',
        'estimated_value', 'publish_date',
    ]
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return RFPCreateSerializer
        if self.action == 'list':
            return RFPListSerializer
        return RFPSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(organization=user.organization)

        return queryset

    def create(self, request, *args, **kwargs):
        """Create an RFP and return full serializer with all fields."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        response_serializer = RFPSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        """Soft delete the RFP."""
        instance.soft_delete()

    def _handle_workflow_action(self, rfp, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            rfp.refresh_from_db()
            return Response(RFPSerializer(rfp).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ============ Workflow Actions ============

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish the RFP (DRAFT -> PUBLISHED)."""
        rfp = self.get_object()
        response = self._handle_workflow_action(rfp, rfp.publish)
        if response.status_code == 200:
            # Send notifications to invited suppliers
            RFPNotificationService.notify_rfp_published(rfp)
        return response

    @action(detail=True, methods=['post'])
    def start_evaluation(self, request, pk=None):
        """Start evaluation phase (PUBLISHED -> EVALUATION)."""
        rfp = self.get_object()
        return self._handle_workflow_action(rfp, rfp.start_evaluation)

    @action(detail=True, methods=['post'])
    def start_bafo_round(self, request, pk=None):
        """Start BAFO round (EVALUATION -> BAFO)."""
        rfp = self.get_object()
        return self._handle_workflow_action(rfp, rfp.start_bafo_round)

    @action(detail=True, methods=['post'])
    def close_bafo_round(self, request, pk=None):
        """Close BAFO round (BAFO -> EVALUATION)."""
        rfp = self.get_object()
        return self._handle_workflow_action(rfp, rfp.close_bafo_round)

    @action(detail=True, methods=['post'])
    def close_evaluation(self, request, pk=None):
        """Close evaluation (EVALUATION/BAFO -> CLOSED)."""
        rfp = self.get_object()
        return self._handle_workflow_action(rfp, rfp.close_evaluation)

    @action(detail=True, methods=['post'])
    def award(self, request, pk=None):
        """Award the RFP to a proposal (CLOSED -> AWARDED)."""
        rfp = self.get_object()
        serializer = AwardProposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        proposal_id = serializer.validated_data['proposal_id']
        try:
            proposal = Proposal.objects.get(id=proposal_id)
        except Proposal.DoesNotExist:
            return Response(
                {'error': f'Proposal with id {proposal_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = self._handle_workflow_action(rfp, rfp.award, proposal)
        if response.status_code == 200:
            # Notify winning supplier
            RFPNotificationService.notify_proposal_awarded(proposal)
            # Notify non-winning suppliers
            for other_proposal in rfp.proposals.filter(status='NOT_AWARDED'):
                RFPNotificationService.notify_proposal_not_awarded(other_proposal)
        return response

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the RFP (Any -> CANCELLED, except from AWARDED)."""
        rfp = self.get_object()
        return self._handle_workflow_action(rfp, rfp.cancel)

    # ============ Nested Resources ============

    @action(detail=True, methods=['get', 'post'])
    def sections(self, request, pk=None):
        """
        Manage RFP sections.

        GET: List all sections
        POST: Add a new section (DRAFT only)
        """
        rfp = self.get_object()

        if request.method == 'GET':
            serializer = RFPSectionSerializer(rfp.sections.all(), many=True)
            return Response(serializer.data)

        # POST - add new section
        if rfp.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add sections to non-draft RFP'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RFPSectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        section = RFPSection.objects.create(rfp=rfp, **serializer.validated_data)
        return Response(
            RFPSectionSerializer(section).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'], url_path='sections/(?P<section_id>[^/.]+)/questions')
    def section_questions(self, request, pk=None, section_id=None):
        """
        Manage questions within a section.

        GET: List all questions in section
        POST: Add a new question (DRAFT only)
        """
        rfp = self.get_object()

        try:
            section = rfp.sections.get(id=section_id)
        except RFPSection.DoesNotExist:
            return Response(
                {'error': 'Section not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == 'GET':
            serializer = RFPQuestionSerializer(section.questions.all(), many=True)
            return Response(serializer.data)

        # POST - add new question
        if rfp.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add questions to non-draft RFP'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RFPQuestionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = RFPQuestion.objects.create(section=section, **serializer.validated_data)
        return Response(
            RFPQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'])
    def line_items(self, request, pk=None):
        """
        Manage RFP line items.

        GET: List all line items
        POST: Add a new line item (DRAFT only)
        """
        rfp = self.get_object()

        if request.method == 'GET':
            serializer = RFPLineItemSerializer(rfp.line_items.all(), many=True)
            return Response(serializer.data)

        # POST - add new line item
        if rfp.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add line items to non-draft RFP'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RFPLineItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        line_item = RFPLineItem.objects.create(rfp=rfp, **serializer.validated_data)
        return Response(
            RFPLineItemSerializer(line_item).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'])
    def invitations(self, request, pk=None):
        """
        Manage supplier invitations.

        GET: List all invitations
        POST: Invite a supplier (DRAFT only)
        """
        rfp = self.get_object()

        if request.method == 'GET':
            serializer = RFPInvitationSerializer(rfp.invitations.all(), many=True)
            return Response(serializer.data)

        # POST - invite supplier
        if rfp.status != 'DRAFT':
            return Response(
                {'error': 'Cannot invite suppliers to non-draft RFP'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RFPInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            invitation = RFPInvitation.objects.create(
                rfp=rfp,
                supplier=serializer.validated_data['supplier'],
                invited_by=serializer.validated_data.get('invited_by', request.user),
            )
            return Response(
                RFPInvitationSerializer(invitation).data,
                status=status.HTTP_201_CREATED,
            )
        except DuplicateInvitationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get', 'post'])
    def criteria(self, request, pk=None):
        """
        Manage scoring criteria.

        GET: List all criteria
        POST: Add new criteria (DRAFT only)
        """
        rfp = self.get_object()

        if request.method == 'GET':
            # Only return top-level criteria (no parent)
            criteria = rfp.criteria.filter(parent__isnull=True)
            serializer = ScoringCriteriaSerializer(criteria, many=True)
            return Response(serializer.data)

        # POST - add new criteria
        if rfp.status != 'DRAFT':
            return Response(
                {'error': 'Cannot add criteria to non-draft RFP'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ScoringCriteriaCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        criteria = ScoringCriteria.objects.create(rfp=rfp, **serializer.validated_data)
        return Response(
            ScoringCriteriaSerializer(criteria).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'])
    def evaluators(self, request, pk=None):
        """
        Manage evaluation team.

        GET: List all evaluators
        POST: Add an evaluator
        """
        rfp = self.get_object()

        if request.method == 'GET':
            serializer = EvaluationTeamSerializer(rfp.evaluation_team.all(), many=True)
            return Response(serializer.data)

        # POST - add evaluator
        serializer = EvaluationTeamCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            team_member = EvaluationTeam.objects.create(
                rfp=rfp,
                evaluator=serializer.validated_data['evaluator'],
                role=serializer.validated_data.get('role', 'GENERAL'),
                assigned_by=serializer.validated_data.get('assigned_by', request.user),
            )
            # Handle assigned_sections if provided
            if 'assigned_sections' in serializer.validated_data:
                team_member.assigned_sections.set(
                    serializer.validated_data['assigned_sections']
                )
            return Response(
                EvaluationTeamSerializer(team_member).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get', 'post'])
    def qa(self, request, pk=None):
        """
        Manage Q&A.

        GET: List all Q&A items
        POST: Submit a question
        """
        rfp = self.get_object()

        if request.method == 'GET':
            # Filter based on visibility for non-staff users
            qa_items = rfp.qa_items.all()
            if not request.user.is_staff:
                # Only show published items or items asked by this user
                qa_items = qa_items.filter(is_published=True) | qa_items.filter(
                    asked_by=request.user
                )
            serializer = RFPQASerializer(qa_items.distinct(), many=True)
            return Response(serializer.data)

        # POST - submit question
        serializer = RFPQACreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        qa_item = RFPQA.objects.create(
            rfp=rfp,
            asked_by=serializer.validated_data.get('asked_by', request.user),
            supplier=serializer.validated_data.get('supplier'),
            question=serializer.validated_data['question'],
            visibility=serializer.validated_data.get('visibility', 'PRIVATE'),
        )
        return Response(
            RFPQASerializer(qa_item).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='qa/(?P<qa_id>[^/.]+)/answer')
    def answer_question(self, request, pk=None, qa_id=None):
        """Answer a Q&A question."""
        rfp = self.get_object()

        try:
            qa_item = rfp.qa_items.get(id=qa_id)
        except RFPQA.DoesNotExist:
            return Response(
                {'error': 'Question not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = RFPQAAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        qa_item.publish_answer(
            answer=serializer.validated_data['answer'],
            answered_by=request.user,
            visibility=serializer.validated_data.get('visibility', 'ALL_BIDDERS'),
        )
        # Notify suppliers about the answered question
        RFPNotificationService.notify_qa_answered(qa_item)
        return Response(RFPQASerializer(qa_item).data)

    @action(detail=True, methods=['get', 'post'], url_path='bafo-rounds')
    def bafo_rounds(self, request, pk=None):
        """
        Manage BAFO rounds.

        GET: List all BAFO rounds
        POST: Create a new BAFO round
        """
        rfp = self.get_object()

        if request.method == 'GET':
            serializer = BAFORoundSerializer(rfp.bafo_rounds.all(), many=True)
            return Response(serializer.data)

        # POST - create BAFO round
        if rfp.status not in ['EVALUATION', 'BAFO']:
            return Response(
                {'error': 'Can only create BAFO rounds during evaluation'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BAFORoundCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bafo_round = BAFORound.objects.create(
            rfp=rfp,
            created_by=serializer.validated_data.get('created_by', request.user),
            instructions=serializer.validated_data.get('instructions', ''),
            deadline=serializer.validated_data.get('deadline'),
            focus_areas=serializer.validated_data.get('focus_areas'),
        )
        return Response(
            BAFORoundSerializer(bafo_round).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def proposals(self, request, pk=None):
        """List all proposals for this RFP."""
        rfp = self.get_object()
        serializer = ProposalListSerializer(rfp.proposals.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def compare(self, request, pk=None):
        """
        Get proposal comparison matrix for this RFP.

        Returns a comparison of all submitted proposals by criteria and line items.
        """
        rfp = self.get_object()

        # Get all relevant proposals (submitted, shortlisted, BAFO)
        proposals = rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        )

        # Build line item comparison
        line_comparison = []
        for line_item in rfp.line_items.all():
            line_data = {
                'line_id': str(line_item.id),
                'line_number': line_item.line_number,
                'description': line_item.description,
                'quantity': str(line_item.quantity),
                'target_unit_price': str(line_item.target_unit_price) if line_item.target_unit_price else None,
                'proposals': [],
            }

            for proposal in proposals:
                try:
                    prop_line = ProposalLineItem.objects.get(
                        proposal=proposal, rfp_line_item=line_item
                    )
                    line_data['proposals'].append({
                        'proposal_id': str(proposal.id),
                        'supplier_name': proposal.supplier.name,
                        'unit_price': str(prop_line.unit_price),
                        'extended_price': str(prop_line.extended_price),
                        'lead_time_days': prop_line.lead_time_days,
                    })
                except ProposalLineItem.DoesNotExist:
                    line_data['proposals'].append({
                        'proposal_id': str(proposal.id),
                        'supplier_name': proposal.supplier.name,
                        'unit_price': None,
                        'extended_price': None,
                        'lead_time_days': None,
                    })

            line_comparison.append(line_data)

        # Build score summary
        score_summary = []
        for proposal in proposals:
            score_summary.append({
                'proposal_id': str(proposal.id),
                'supplier_name': proposal.supplier.name,
                'technical_score': str(proposal.technical_score) if proposal.technical_score else None,
                'management_score': str(proposal.management_score) if proposal.management_score else None,
                'pricing_score': str(proposal.pricing_score) if proposal.pricing_score else None,
                'overall_score': str(proposal.overall_score) if proposal.overall_score else None,
                'rank': proposal.rank,
                'total_amount': str(proposal.total_amount),
            })

        return Response({
            'rfp_id': str(rfp.id),
            'rfp_number': rfp.number,
            'rfp_title': rfp.title,
            'total_proposals': proposals.count(),
            'line_item_comparison': line_comparison,
            'score_summary': score_summary,
        })

    @action(detail=True, methods=['get'])
    def evaluation_summary(self, request, pk=None):
        """Get evaluation summary for this RFP."""
        rfp = self.get_object()

        proposals = rfp.proposals.filter(
            status__in=['SUBMITTED', 'SHORTLISTED', 'BAFO_SUBMITTED']
        )

        # Count evaluated proposals (those with scores)
        evaluated_count = proposals.filter(overall_score__isnull=False).count()

        # Get evaluator completion status
        evaluator_status = {}
        for team_member in rfp.evaluation_team.all():
            scores_given = EvaluationScore.objects.filter(
                proposal__rfp=rfp,
                evaluator=team_member.evaluator,
            ).count()
            evaluator_status[team_member.evaluator.email] = {
                'role': team_member.role,
                'scores_submitted': scores_given,
            }

        # Get ranking
        ranked_proposals = []
        for proposal in proposals.filter(overall_score__isnull=False).order_by('rank'):
            ranked_proposals.append({
                'proposal_id': str(proposal.id),
                'supplier_name': proposal.supplier.name,
                'overall_score': str(proposal.overall_score),
                'rank': proposal.rank,
                'status': proposal.status,
            })

        return Response({
            'rfp_id': str(rfp.id),
            'rfp_number': rfp.number,
            'total_proposals': proposals.count(),
            'evaluated_proposals': evaluated_count,
            'evaluator_completion': evaluator_status,
            'rankings': ranked_proposals,
        })


class RFPInvitationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RFP invitation management.
    """

    queryset = RFPInvitation.objects.all()
    serializer_class = RFPInvitationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfp', 'supplier', 'status', 'intent_to_bid']
    search_fields = ['supplier__name']
    ordering_fields = ['invited_at', 'status']
    ordering = ['-invited_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(rfp__organization=user.organization)

        return queryset

    @action(detail=True, methods=['post'])
    def mark_viewed(self, request, pk=None):
        """Mark invitation as viewed."""
        invitation = self.get_object()
        invitation.mark_viewed()
        return Response(RFPInvitationSerializer(invitation).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline the invitation."""
        invitation = self.get_object()
        serializer = DeclineInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        invitation.decline(reason)
        return Response(RFPInvitationSerializer(invitation).data)

    @action(detail=True, methods=['post'])
    def intent_to_bid(self, request, pk=None):
        """Indicate intent to bid."""
        invitation = self.get_object()
        serializer = IntentToBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invitation.intent_to_bid = serializer.validated_data['intent']
        invitation.save(update_fields=['intent_to_bid', 'updated_at'])
        return Response(RFPInvitationSerializer(invitation).data)

    @action(detail=True, methods=['post'])
    def disqualify(self, request, pk=None):
        """Disqualify the supplier from this RFP."""
        invitation = self.get_object()
        serializer = DisqualifyProposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        invitation.disqualify(reason)
        return Response(RFPInvitationSerializer(invitation).data)


class ProposalViewSet(viewsets.ModelViewSet):
    """
    ViewSet for proposal management.

    Proposals can only be modified when in DRAFT status.
    """

    queryset = Proposal.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfp', 'supplier', 'status', 'is_latest']
    search_fields = ['proposal_number', 'supplier__name', 'rfp__number', 'notes']
    ordering_fields = ['created_at', 'submitted_at', 'status', 'overall_score', 'rank']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ProposalCreateSerializer
        if self.action == 'list':
            return ProposalListSerializer
        return ProposalSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            # Show proposals for RFPs in user's organization OR proposals by user
            queryset = queryset.filter(
                rfp__organization=user.organization
            ) | queryset.filter(
                submitted_by=user
            )

        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        """Create a proposal and return full serializer."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        response_serializer = ProposalSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        """Soft delete the proposal."""
        instance.soft_delete()

    # ============ Workflow Actions ============

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit the proposal (DRAFT -> SUBMITTED)."""
        proposal = self.get_object()
        try:
            proposal.submit()
            proposal.refresh_from_db()
            # Notify RFP owner about the new proposal
            RFPNotificationService.notify_proposal_received(proposal)
            return Response(ProposalSerializer(proposal).data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw the proposal (DRAFT/SUBMITTED -> WITHDRAWN)."""
        proposal = self.get_object()
        try:
            proposal.withdraw()
            proposal.refresh_from_db()
            return Response(ProposalSerializer(proposal).data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def shortlist(self, request, pk=None):
        """Shortlist the proposal (SUBMITTED -> SHORTLISTED)."""
        proposal = self.get_object()
        try:
            proposal.shortlist()
            proposal.refresh_from_db()
            # Notify supplier about shortlisting
            RFPNotificationService.notify_proposal_shortlisted(proposal)
            return Response(ProposalSerializer(proposal).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def request_bafo(self, request, pk=None):
        """Request BAFO from this supplier (SHORTLISTED -> BAFO_REQUESTED)."""
        proposal = self.get_object()
        try:
            proposal.request_bafo()
            proposal.refresh_from_db()
            return Response(ProposalSerializer(proposal).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def submit_bafo(self, request, pk=None):
        """Mark BAFO as submitted (BAFO_REQUESTED -> BAFO_SUBMITTED)."""
        proposal = self.get_object()
        try:
            proposal.submit_bafo()
            proposal.refresh_from_db()
            return Response(ProposalSerializer(proposal).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def disqualify(self, request, pk=None):
        """Disqualify the proposal."""
        proposal = self.get_object()
        serializer = DisqualifyProposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        try:
            proposal.disqualify(reason)
            proposal.refresh_from_db()
            return Response(ProposalSerializer(proposal).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def score(self, request, pk=None):
        """Submit evaluation scores for this proposal."""
        proposal = self.get_object()
        serializer = EvaluationScoreCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Set proposal and evaluator
        score = EvaluationScore.objects.create(
            proposal=proposal,
            evaluator=serializer.validated_data.get('evaluator', request.user),
            criteria=serializer.validated_data.get('criteria'),
            section=serializer.validated_data.get('section'),
            question=serializer.validated_data.get('question'),
            score=serializer.validated_data['score'],
            max_score=serializer.validated_data.get('max_score', 5.0),
            comments=serializer.validated_data.get('comments', ''),
            is_final=serializer.validated_data.get('is_final', False),
        )
        return Response(
            EvaluationScoreSerializer(score).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def calculate_scores(self, request, pk=None):
        """Calculate and update overall scores for this proposal."""
        proposal = self.get_object()
        try:
            ScoringService.update_proposal_scores(proposal)
            proposal.refresh_from_db()
            return Response(ProposalSerializer(proposal).data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ============ Nested Resources ============

    @action(detail=True, methods=['get', 'post'])
    def question_responses(self, request, pk=None):
        """
        Manage question responses.

        GET: List all responses
        POST: Add/update a response (DRAFT only)
        """
        proposal = self.get_object()

        if request.method == 'GET':
            serializer = QuestionResponseSerializer(
                proposal.question_responses.all(), many=True
            )
            return Response(serializer.data)

        # POST - add/update response
        if proposal.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify responses of non-draft proposal'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = QuestionResponseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']

        # Check if response already exists
        try:
            response = QuestionResponse.objects.get(
                proposal=proposal, question=question
            )
            # Update existing
            for key, value in serializer.validated_data.items():
                setattr(response, key, value)
            response.save()
        except QuestionResponse.DoesNotExist:
            # Create new
            response = QuestionResponse.objects.create(
                proposal=proposal, **serializer.validated_data
            )

        return Response(
            QuestionResponseSerializer(response).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'])
    def line_items(self, request, pk=None):
        """
        Manage pricing line items.

        GET: List all line items
        POST: Add/update a line item (DRAFT only)
        """
        proposal = self.get_object()

        if request.method == 'GET':
            serializer = ProposalLineItemSerializer(
                proposal.line_items.all(), many=True
            )
            return Response(serializer.data)

        # POST - add/update line item
        if proposal.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify line items of non-draft proposal'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProposalLineItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rfp_line_item = serializer.validated_data['rfp_line_item']

        # Check if line item already exists
        try:
            line_item = ProposalLineItem.objects.get(
                proposal=proposal, rfp_line_item=rfp_line_item
            )
            # Update existing
            for key, value in serializer.validated_data.items():
                setattr(line_item, key, value)
            line_item.save()
        except ProposalLineItem.DoesNotExist:
            # Create new
            line_item = ProposalLineItem.objects.create(
                proposal=proposal, **serializer.validated_data
            )

        return Response(
            ProposalLineItemSerializer(line_item).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def scores(self, request, pk=None):
        """Get all evaluation scores for this proposal."""
        proposal = self.get_object()
        serializer = EvaluationScoreSerializer(
            proposal.evaluation_scores.all(), many=True
        )
        return Response(serializer.data)


class BAFORoundViewSet(viewsets.ModelViewSet):
    """
    ViewSet for BAFO round management.
    """

    queryset = BAFORound.objects.all()
    serializer_class = BAFORoundSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfp', 'status']
    search_fields = ['rfp__number', 'instructions']
    ordering_fields = ['round_number', 'created_at', 'opened_at']
    ordering = ['round_number']

    def get_serializer_class(self):
        if self.action == 'create':
            return BAFORoundCreateSerializer
        return BAFORoundSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(rfp__organization=user.organization)

        return queryset

    def create(self, request, *args, **kwargs):
        """Create BAFO round and return full serializer."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(created_by=request.user)
        response_serializer = BAFORoundSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def open(self, request, pk=None):
        """Open the BAFO round (DRAFT -> OPEN)."""
        bafo_round = self.get_object()
        try:
            bafo_round.open()
            bafo_round.refresh_from_db()
            # Notify shortlisted suppliers about BAFO request
            RFPNotificationService.notify_bafo_requested(bafo_round)
            return Response(BAFORoundSerializer(bafo_round).data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close the BAFO round (OPEN -> CLOSED)."""
        bafo_round = self.get_object()
        try:
            bafo_round.close()
            bafo_round.refresh_from_db()
            return Response(BAFORoundSerializer(bafo_round).data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['get', 'post'])
    def responses(self, request, pk=None):
        """
        Manage BAFO responses.

        GET: List all responses
        POST: Create a response (OPEN round only)
        """
        bafo_round = self.get_object()

        if request.method == 'GET':
            serializer = BAFOResponseSerializer(bafo_round.responses.all(), many=True)
            return Response(serializer.data)

        # POST - create response
        if bafo_round.status != 'OPEN':
            return Response(
                {'error': 'Can only create responses for open BAFO rounds'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BAFOResponseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        response = BAFOResponse.objects.create(
            bafo_round=bafo_round,
            proposal=serializer.validated_data['proposal'],
            response_data=serializer.validated_data.get('response_data'),
            notes=serializer.validated_data.get('notes', ''),
        )
        return Response(
            BAFOResponseSerializer(response).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='responses/(?P<response_id>[^/.]+)/submit')
    def submit_response(self, request, pk=None, response_id=None):
        """Submit a BAFO response."""
        bafo_round = self.get_object()

        try:
            bafo_response = bafo_round.responses.get(id=response_id)
        except BAFOResponse.DoesNotExist:
            return Response(
                {'error': 'Response not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            bafo_response.submit()
            bafo_response.refresh_from_db()
            # Notify RFP owner about BAFO response
            RFPNotificationService.notify_bafo_received(bafo_response)
            return Response(BAFOResponseSerializer(bafo_response).data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class EvaluationTeamViewSet(viewsets.ModelViewSet):
    """
    ViewSet for evaluation team management.
    """

    queryset = EvaluationTeam.objects.all()
    serializer_class = EvaluationTeamSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfp', 'role', 'evaluator']
    search_fields = ['evaluator__email', 'evaluator__first_name', 'evaluator__last_name']
    ordering_fields = ['assigned_at', 'role']
    ordering = ['-assigned_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(rfp__organization=user.organization)

        return queryset


class ScoringCriteriaViewSet(viewsets.ModelViewSet):
    """
    ViewSet for scoring criteria management.
    """

    queryset = ScoringCriteria.objects.all()
    serializer_class = ScoringCriteriaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfp', 'section', 'parent']
    search_fields = ['name', 'description']
    ordering_fields = ['order', 'weight']
    ordering = ['order']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Filter by user's organization unless admin
        if not user.is_staff and user.organization:
            queryset = queryset.filter(rfp__organization=user.organization)

        return queryset

    def _check_draft_status(self, criteria):
        """Ensure RFP is in DRAFT status for modifications."""
        if criteria.rfp.status != 'DRAFT':
            return Response(
                {'error': 'Cannot modify criteria of non-draft RFP'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def update(self, request, *args, **kwargs):
        criteria = self.get_object()
        error_response = self._check_draft_status(criteria)
        if error_response:
            return error_response
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        criteria = self.get_object()
        error_response = self._check_draft_status(criteria)
        if error_response:
            return error_response
        return super().destroy(request, *args, **kwargs)

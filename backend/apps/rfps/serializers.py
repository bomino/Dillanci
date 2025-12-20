"""
RFP serializers for API endpoints.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.core.utils.sanitization import sanitize_html
from apps.users.models import User
from .models import (
    BAFORound,
    BAFOResponse,
    EvaluationScore,
    EvaluationTeam,
    Proposal,
    ProposalLineItem,
    ProposalSection,
    QuestionResponse,
    RFP,
    RFPInvitation,
    RFPLineItem,
    RFPQuestion,
    RFPSection,
    RFPQA,
    ScoringCriteria,
)


# ============ RFP Serializers ============

class RFPQuestionSerializer(serializers.ModelSerializer):
    """Serializer for RFP questions."""

    class Meta:
        model = RFPQuestion
        fields = [
            'id', 'section', 'question_number', 'question_text',
            'question_type', 'options', 'is_required', 'max_score',
            'scoring_guidance', 'order',
            # Compliance tracking fields
            'is_mandatory_attachment', 'attachment_type', 'min_attachments',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RFPQuestionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFP questions."""

    class Meta:
        model = RFPQuestion
        fields = [
            'question_text', 'question_type', 'options', 'is_required',
            'max_score', 'scoring_guidance', 'order',
            # Compliance tracking fields
            'is_mandatory_attachment', 'attachment_type', 'min_attachments',
        ]


class RFPSectionSerializer(serializers.ModelSerializer):
    """Serializer for RFP sections with nested questions."""

    questions = RFPQuestionSerializer(many=True, read_only=True)
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = RFPSection
        fields = [
            'id', 'rfp', 'section_number', 'title', 'section_type',
            'weight', 'instructions', 'is_scorable', 'order',
            'questions', 'question_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_question_count(self, obj):
        return obj.questions.count()


class RFPSectionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFP sections."""

    questions = RFPQuestionCreateSerializer(many=True, required=False)

    class Meta:
        model = RFPSection
        fields = [
            'title', 'section_type', 'weight', 'instructions',
            'is_scorable', 'order', 'questions',
        ]

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        section = RFPSection.objects.create(**validated_data)

        for question_data in questions_data:
            RFPQuestion.objects.create(section=section, **question_data)

        return section


class RFPLineItemSerializer(serializers.ModelSerializer):
    """Serializer for RFP line items."""

    extended_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    catalog_item_name = serializers.CharField(
        source='catalog_item.name', read_only=True
    )

    class Meta:
        model = RFPLineItem
        fields = [
            'id', 'rfp', 'section', 'line_number', 'description',
            'quantity', 'unit_of_measure', 'target_unit_price',
            'catalog_item', 'catalog_item_name', 'extended_amount',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RFPLineItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFP line items."""

    class Meta:
        model = RFPLineItem
        fields = [
            'description', 'quantity', 'unit_of_measure',
            'target_unit_price', 'catalog_item', 'section', 'notes',
        ]


class ScoringCriteriaSerializer(serializers.ModelSerializer):
    """Serializer for scoring criteria."""

    sub_criteria = serializers.SerializerMethodField()

    class Meta:
        model = ScoringCriteria
        fields = [
            'id', 'rfp', 'name', 'description', 'weight', 'section',
            'parent', 'max_score', 'order', 'sub_criteria',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_sub_criteria(self, obj):
        children = obj.sub_criteria.all()
        return ScoringCriteriaSerializer(children, many=True).data


class ScoringCriteriaCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating scoring criteria."""

    class Meta:
        model = ScoringCriteria
        fields = [
            'name', 'description', 'weight', 'section', 'parent',
            'max_score', 'order',
        ]


class RFPSerializer(serializers.ModelSerializer):
    """Full serializer for RFP with nested data."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    awarded_supplier_name = serializers.CharField(
        source='awarded_supplier.name', read_only=True
    )
    sections = RFPSectionSerializer(many=True, read_only=True)
    criteria = ScoringCriteriaSerializer(many=True, read_only=True)
    line_items = RFPLineItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    ip_ownership_display = serializers.CharField(
        source='get_ip_ownership_display', read_only=True
    )
    total_section_weight = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    proposal_count = serializers.SerializerMethodField()
    invitation_count = serializers.SerializerMethodField()

    class Meta:
        model = RFP
        fields = [
            # Core fields
            'id', 'number', 'organization', 'organization_name',
            'created_by', 'created_by_name', 'title', 'description',
            'status', 'status_display', 'rfp_type', 'estimated_value',
            'bidding_type', 'visibility', 'requisition', 'notes',
            # Project Overview fields (Essential RFP Section 1)
            'executive_summary', 'current_state_description',
            'future_state_goals', 'organization_context',
            # Timeline fields (Essential RFP Section 4)
            'publish_date', 'question_deadline', 'response_deadline',
            'evaluation_start_date', 'award_target_date',
            'qa_session_date', 'shortlist_announcement_date',
            'contract_start_date', 'contract_end_date',
            # Budget Framework fields (Essential RFP Section 5)
            'budget_min', 'budget_max', 'currency',
            # Terms & Conditions fields (Essential RFP Section 7)
            'nda_required', 'payment_terms', 'ip_ownership', 'ip_ownership_display',
            'insurance_requirements', 'confidentiality_terms',
            # Award info
            'awarded_supplier', 'awarded_supplier_name',
            'awarded_proposal', 'awarded_date',
            # Related data
            'sections', 'criteria', 'line_items', 'total_section_weight',
            'proposal_count', 'invitation_count',
            # Timestamps
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'number', 'status', 'publish_date', 'evaluation_start_date',
            'awarded_supplier', 'awarded_proposal', 'awarded_date',
            'created_at', 'updated_at',
        ]

    def get_proposal_count(self, obj):
        return obj.proposals.count()

    def get_invitation_count(self, obj):
        return obj.invitations.count()


class RFPCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFPs."""

    sections = RFPSectionCreateSerializer(many=True, required=False)

    class Meta:
        model = RFP
        fields = [
            # Core fields
            'organization', 'created_by', 'title', 'description',
            'rfp_type', 'estimated_value', 'bidding_type',
            'visibility', 'requisition', 'notes', 'sections',
            # Project Overview fields (Essential RFP Section 1)
            'executive_summary', 'current_state_description',
            'future_state_goals', 'organization_context',
            # Timeline fields (Essential RFP Section 4)
            'question_deadline', 'response_deadline', 'award_target_date',
            'qa_session_date', 'shortlist_announcement_date',
            'contract_start_date', 'contract_end_date',
            # Budget Framework fields (Essential RFP Section 5)
            'budget_min', 'budget_max', 'currency',
            # Terms & Conditions fields (Essential RFP Section 7)
            'nda_required', 'payment_terms', 'ip_ownership',
            'insurance_requirements', 'confidentiality_terms',
        ]

    def validate_description(self, value):
        """Sanitize description to prevent XSS attacks."""
        return sanitize_html(value) if value else value

    def validate_executive_summary(self, value):
        """Sanitize executive_summary to prevent XSS attacks."""
        return sanitize_html(value) if value else value

    def validate_notes(self, value):
        """Sanitize notes to prevent XSS attacks."""
        return sanitize_html(value) if value else value

    def create(self, validated_data):
        sections_data = validated_data.pop('sections', [])
        rfp = RFP.objects.create(**validated_data)

        for section_data in sections_data:
            questions_data = section_data.pop('questions', [])
            section = RFPSection.objects.create(rfp=rfp, **section_data)

            for question_data in questions_data:
                RFPQuestion.objects.create(section=section, **question_data)

        return rfp


class RFPListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for RFP list views."""

    organization_name = serializers.CharField(
        source='organization.name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    proposal_count = serializers.SerializerMethodField()
    invitation_count = serializers.SerializerMethodField()

    class Meta:
        model = RFP
        fields = [
            'id', 'number', 'organization', 'organization_name',
            'title', 'status', 'status_display', 'rfp_type',
            'estimated_value', 'budget_min', 'budget_max', 'currency',
            'response_deadline', 'award_target_date',
            'proposal_count', 'invitation_count',
            'created_at',
        ]
        read_only_fields = fields

    def get_proposal_count(self, obj):
        return obj.proposals.count()

    def get_invitation_count(self, obj):
        return obj.invitations.count()


# ============ Invitation Serializers ============

class RFPInvitationSerializer(serializers.ModelSerializer):
    """Serializer for RFP invitations."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    invited_by_name = serializers.CharField(
        source='invited_by.get_full_name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = RFPInvitation
        fields = [
            'id', 'rfp', 'supplier', 'supplier_name', 'invited_by',
            'invited_by_name', 'invited_at', 'status', 'status_display',
            'viewed_at', 'responded_at', 'intent_to_bid', 'decline_reason',
            'disqualified', 'disqualification_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'invited_at', 'status', 'viewed_at', 'responded_at',
            'created_at', 'updated_at',
        ]


class RFPInvitationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating RFP invitations."""

    invited_by = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )

    class Meta:
        model = RFPInvitation
        fields = ['supplier', 'invited_by']


# ============ Proposal Serializers ============

class QuestionResponseSerializer(serializers.ModelSerializer):
    """Serializer for question responses."""

    question_text = serializers.CharField(
        source='question.question_text', read_only=True
    )
    question_type = serializers.CharField(
        source='question.question_type', read_only=True
    )

    class Meta:
        model = QuestionResponse
        fields = [
            'id', 'proposal', 'question', 'question_text', 'question_type',
            'answer_text', 'answer_choice', 'answer_number', 'answer_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class QuestionResponseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating question responses."""

    class Meta:
        model = QuestionResponse
        fields = [
            'question', 'answer_text', 'answer_choice',
            'answer_number', 'answer_date',
        ]


class ProposalLineItemSerializer(serializers.ModelSerializer):
    """Serializer for proposal line items."""

    rfp_line_description = serializers.CharField(
        source='rfp_line_item.description', read_only=True
    )

    class Meta:
        model = ProposalLineItem
        fields = [
            'id', 'proposal', 'rfp_line_item', 'rfp_line_description',
            'quantity', 'unit_price', 'extended_price', 'lead_time_days',
            'manufacturer', 'part_number', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'extended_price', 'created_at', 'updated_at']


class ProposalLineItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating proposal line items."""

    class Meta:
        model = ProposalLineItem
        fields = [
            'rfp_line_item', 'quantity', 'unit_price', 'lead_time_days',
            'manufacturer', 'part_number', 'notes',
        ]


class ProposalSectionSerializer(serializers.ModelSerializer):
    """Serializer for proposal sections."""

    section_title = serializers.CharField(
        source='rfp_section.title', read_only=True
    )

    class Meta:
        model = ProposalSection
        fields = [
            'id', 'proposal', 'rfp_section', 'section_title',
            'section_score', 'evaluator_comments',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProposalSerializer(serializers.ModelSerializer):
    """Full serializer for proposals."""

    rfp_number = serializers.CharField(source='rfp.number', read_only=True)
    rfp_title = serializers.CharField(source='rfp.title', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    submitted_by_name = serializers.CharField(
        source='submitted_by.get_full_name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    question_responses = QuestionResponseSerializer(many=True, read_only=True)
    line_items = ProposalLineItemSerializer(many=True, read_only=True)
    sections = ProposalSectionSerializer(many=True, read_only=True)

    class Meta:
        model = Proposal
        fields = [
            'id', 'rfp', 'rfp_number', 'rfp_title', 'supplier', 'supplier_name',
            'submitted_by', 'submitted_by_name', 'proposal_number', 'status',
            'status_display', 'submitted_at', 'revision_number', 'is_latest',
            'technical_score', 'management_score', 'pricing_score',
            'overall_score', 'rank', 'valid_until', 'notes', 'total_amount',
            'question_responses', 'line_items', 'sections',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'proposal_number', 'status', 'submitted_at',
            'technical_score', 'management_score', 'pricing_score',
            'overall_score', 'rank', 'created_at', 'updated_at',
        ]


class ProposalCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating proposals."""

    question_responses = QuestionResponseCreateSerializer(many=True, required=False)
    line_items = ProposalLineItemCreateSerializer(many=True, required=False)

    class Meta:
        model = Proposal
        fields = [
            'rfp', 'supplier', 'submitted_by', 'valid_until', 'notes',
            'question_responses', 'line_items',
        ]

    def create(self, validated_data):
        responses_data = validated_data.pop('question_responses', [])
        line_items_data = validated_data.pop('line_items', [])

        proposal = Proposal.objects.create(**validated_data)

        for response_data in responses_data:
            QuestionResponse.objects.create(proposal=proposal, **response_data)

        for line_item_data in line_items_data:
            ProposalLineItem.objects.create(proposal=proposal, **line_item_data)

        return proposal


class ProposalListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for proposal list views."""

    rfp_number = serializers.CharField(source='rfp.number', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )

    class Meta:
        model = Proposal
        fields = [
            'id', 'rfp', 'rfp_number', 'supplier', 'supplier_name',
            'proposal_number', 'status', 'status_display', 'submitted_at',
            'overall_score', 'rank', 'total_amount', 'created_at',
        ]
        read_only_fields = fields


# ============ Evaluation Serializers ============

class EvaluationTeamSerializer(serializers.ModelSerializer):
    """Serializer for evaluation team members."""

    evaluator_name = serializers.CharField(
        source='evaluator.get_full_name', read_only=True
    )
    evaluator_email = serializers.EmailField(
        source='evaluator.email', read_only=True
    )
    assigned_by_name = serializers.CharField(
        source='assigned_by.get_full_name', read_only=True
    )
    role_display = serializers.CharField(
        source='get_role_display', read_only=True
    )

    class Meta:
        model = EvaluationTeam
        fields = [
            'id', 'rfp', 'evaluator', 'evaluator_name', 'evaluator_email',
            'role', 'role_display', 'assigned_sections', 'assigned_at',
            'assigned_by', 'assigned_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'assigned_at', 'created_at', 'updated_at']


class EvaluationTeamCreateSerializer(serializers.ModelSerializer):
    """Serializer for adding evaluation team members."""

    class Meta:
        model = EvaluationTeam
        fields = ['evaluator', 'role', 'assigned_sections', 'assigned_by']


class EvaluationScoreSerializer(serializers.ModelSerializer):
    """Serializer for evaluation scores."""

    evaluator_name = serializers.CharField(
        source='evaluator.get_full_name', read_only=True
    )
    score_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = EvaluationScore
        fields = [
            'id', 'proposal', 'evaluator', 'evaluator_name', 'criteria',
            'section', 'question', 'score', 'max_score', 'score_percentage',
            'comments', 'is_final', 'scored_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'scored_at', 'created_at', 'updated_at']


class EvaluationScoreCreateSerializer(serializers.ModelSerializer):
    """Serializer for submitting evaluation scores."""

    class Meta:
        model = EvaluationScore
        fields = [
            'proposal', 'evaluator', 'criteria', 'section', 'question',
            'score', 'max_score', 'comments', 'is_final',
        ]

    def validate_comments(self, value):
        """Sanitize comments to prevent XSS attacks."""
        return sanitize_html(value) if value else value

    def validate(self, data):
        # Ensure at least one of criteria, section, or question is provided
        if not any([data.get('criteria'), data.get('section'), data.get('question')]):
            raise serializers.ValidationError(
                'Must provide at least one of: criteria, section, or question'
            )
        return data


# ============ BAFO Serializers ============

class BAFOResponseSerializer(serializers.ModelSerializer):
    """Serializer for BAFO responses."""

    supplier_name = serializers.CharField(
        source='proposal.supplier.name', read_only=True
    )
    proposal_number = serializers.CharField(
        source='proposal.proposal_number', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = BAFOResponse
        fields = [
            'id', 'bafo_round', 'proposal', 'proposal_number', 'supplier_name',
            'status', 'status_display', 'submitted_at', 'response_data',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'submitted_at', 'created_at', 'updated_at']


class BAFOResponseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating BAFO responses."""

    class Meta:
        model = BAFOResponse
        fields = ['proposal', 'response_data', 'notes']


class BAFORoundSerializer(serializers.ModelSerializer):
    """Serializer for BAFO rounds."""

    rfp_number = serializers.CharField(source='rfp.number', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    responses = BAFOResponseSerializer(many=True, read_only=True)
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = BAFORound
        fields = [
            'id', 'rfp', 'rfp_number', 'round_number', 'status',
            'status_display', 'opened_at', 'deadline', 'closed_at',
            'instructions', 'focus_areas', 'created_by', 'created_by_name',
            'responses', 'response_count', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'round_number', 'status', 'opened_at', 'closed_at',
            'created_at', 'updated_at',
        ]

    def get_response_count(self, obj):
        return obj.responses.count()


class BAFORoundCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating BAFO rounds."""

    created_by = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )

    class Meta:
        model = BAFORound
        fields = ['instructions', 'deadline', 'focus_areas', 'created_by']


# ============ Q&A Serializers ============

class RFPQASerializer(serializers.ModelSerializer):
    """Serializer for RFP Q&A items."""

    supplier_name = serializers.CharField(
        source='supplier.name', read_only=True, allow_null=True
    )
    asked_by_name = serializers.CharField(
        source='asked_by.get_full_name', read_only=True
    )
    answered_by_name = serializers.CharField(
        source='answered_by.get_full_name', read_only=True, allow_null=True
    )
    visibility_display = serializers.CharField(
        source='get_visibility_display', read_only=True
    )

    class Meta:
        model = RFPQA
        fields = [
            'id', 'rfp', 'supplier', 'supplier_name', 'asked_by',
            'asked_by_name', 'question', 'answer', 'answered_by',
            'answered_by_name', 'answered_at', 'visibility',
            'visibility_display', 'is_published', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'answered_at', 'created_at', 'updated_at',
        ]


class RFPQACreateSerializer(serializers.ModelSerializer):
    """Serializer for submitting Q&A questions."""

    class Meta:
        model = RFPQA
        fields = ['supplier', 'asked_by', 'question', 'visibility']

    def validate_question(self, value):
        """Sanitize question to prevent XSS attacks."""
        return sanitize_html(value) if value else value


class RFPQAAnswerSerializer(serializers.Serializer):
    """Serializer for answering Q&A questions."""

    answer = serializers.CharField()
    visibility = serializers.ChoiceField(
        choices=RFPQA.VISIBILITY_CHOICES,
        default='ALL_BIDDERS',
    )

    def validate_answer(self, value):
        """Sanitize answer to prevent XSS attacks."""
        return sanitize_html(value) if value else value


# ============ Action Serializers ============

class AwardProposalSerializer(serializers.Serializer):
    """Serializer for awarding an RFP to a proposal."""

    proposal_id = serializers.UUIDField()

    def validate_proposal_id(self, value):
        try:
            Proposal.objects.get(id=value)
        except Proposal.DoesNotExist:
            raise serializers.ValidationError('Proposal not found')
        return value


class ShortlistProposalSerializer(serializers.Serializer):
    """Serializer for shortlisting proposals."""

    proposal_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )

    def validate_proposal_ids(self, value):
        proposals = Proposal.objects.filter(id__in=value)
        if proposals.count() != len(value):
            raise serializers.ValidationError('One or more proposals not found')
        return value


class DisqualifyProposalSerializer(serializers.Serializer):
    """Serializer for disqualifying a proposal."""

    reason = serializers.CharField(required=False, default='')


class DeclineInvitationSerializer(serializers.Serializer):
    """Serializer for declining an RFP invitation."""

    reason = serializers.CharField(required=False, default='')


class IntentToBidSerializer(serializers.Serializer):
    """Serializer for indicating intent to bid."""

    intent = serializers.ChoiceField(choices=['YES', 'NO', 'UNDECIDED'])


# ============ Comparison Serializers ============

class ProposalComparisonSerializer(serializers.Serializer):
    """Serializer for proposal comparison matrix."""

    rfp_id = serializers.UUIDField()
    rfp_number = serializers.CharField()
    rfp_title = serializers.CharField()
    proposals = serializers.ListField()
    line_item_comparison = serializers.ListField()
    section_comparison = serializers.ListField()
    summary = serializers.DictField()


class EvaluationSummarySerializer(serializers.Serializer):
    """Serializer for evaluation summary."""

    rfp_id = serializers.UUIDField()
    rfp_number = serializers.CharField()
    total_proposals = serializers.IntegerField()
    evaluated_proposals = serializers.IntegerField()
    evaluator_completion = serializers.DictField()
    score_summary = serializers.ListField()

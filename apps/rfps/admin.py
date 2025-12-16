"""
Admin configuration for RFP models.
"""

from django.contrib import admin

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


# ============ Inline Admins ============

class RFPSectionInline(admin.TabularInline):
    """Inline admin for RFPSection."""

    model = RFPSection
    extra = 0
    readonly_fields = ['section_number', 'created_at']
    fields = [
        'section_number',
        'title',
        'section_type',
        'weight',
        'is_scorable',
        'order',
    ]


class RFPQuestionInline(admin.TabularInline):
    """Inline admin for RFPQuestion."""

    model = RFPQuestion
    extra = 0
    readonly_fields = ['question_number', 'created_at']
    fields = [
        'question_number',
        'question_text',
        'question_type',
        'is_required',
        'max_score',
        'order',
    ]


class RFPLineItemInline(admin.TabularInline):
    """Inline admin for RFPLineItem."""

    model = RFPLineItem
    extra = 0
    readonly_fields = ['line_number', 'extended_amount', 'created_at']
    fields = [
        'line_number',
        'description',
        'quantity',
        'unit_of_measure',
        'target_unit_price',
        'extended_amount',
        'catalog_item',
    ]


class RFPInvitationInline(admin.TabularInline):
    """Inline admin for RFPInvitation."""

    model = RFPInvitation
    extra = 0
    readonly_fields = ['invited_at', 'viewed_at', 'responded_at']
    fields = [
        'supplier',
        'status',
        'intent_to_bid',
        'invited_by',
        'invited_at',
        'viewed_at',
    ]


class ScoringCriteriaInline(admin.TabularInline):
    """Inline admin for ScoringCriteria."""

    model = ScoringCriteria
    extra = 0
    readonly_fields = ['created_at']
    fields = [
        'name',
        'description',
        'weight',
        'max_score',
        'section',
        'parent',
        'order',
    ]


class EvaluationTeamInline(admin.TabularInline):
    """Inline admin for EvaluationTeam."""

    model = EvaluationTeam
    extra = 0
    readonly_fields = ['assigned_at']
    fields = [
        'evaluator',
        'role',
        'assigned_by',
        'assigned_at',
    ]


class BAFORoundInline(admin.TabularInline):
    """Inline admin for BAFORound."""

    model = BAFORound
    extra = 0
    readonly_fields = ['round_number', 'opened_at', 'closed_at', 'created_at']
    fields = [
        'round_number',
        'status',
        'deadline',
        'opened_at',
        'closed_at',
        'created_by',
    ]


class ProposalSectionInline(admin.TabularInline):
    """Inline admin for ProposalSection."""

    model = ProposalSection
    extra = 0
    readonly_fields = ['created_at']
    fields = [
        'rfp_section',
        'section_score',
        'evaluator_comments',
    ]


class QuestionResponseInline(admin.TabularInline):
    """Inline admin for QuestionResponse."""

    model = QuestionResponse
    extra = 0
    readonly_fields = ['created_at']
    fields = [
        'question',
        'answer_text',
        'answer_choice',
        'answer_number',
        'answer_date',
    ]


class ProposalLineItemInline(admin.TabularInline):
    """Inline admin for ProposalLineItem."""

    model = ProposalLineItem
    extra = 0
    readonly_fields = ['extended_price', 'created_at']
    fields = [
        'rfp_line_item',
        'quantity',
        'unit_price',
        'extended_price',
        'lead_time_days',
        'manufacturer',
    ]


class EvaluationScoreInline(admin.TabularInline):
    """Inline admin for EvaluationScore."""

    model = EvaluationScore
    extra = 0
    readonly_fields = ['scored_at', 'score_percentage']
    fields = [
        'evaluator',
        'criteria',
        'section',
        'question',
        'score',
        'max_score',
        'score_percentage',
        'is_final',
    ]


class BAFOResponseInline(admin.TabularInline):
    """Inline admin for BAFOResponse."""

    model = BAFOResponse
    extra = 0
    readonly_fields = ['submitted_at', 'created_at']
    fields = [
        'proposal',
        'status',
        'submitted_at',
        'notes',
    ]


class RFPQAInline(admin.TabularInline):
    """Inline admin for RFPQA."""

    model = RFPQA
    extra = 0
    readonly_fields = ['answered_at', 'created_at']
    fields = [
        'supplier',
        'asked_by',
        'question',
        'answer',
        'visibility',
        'is_published',
    ]


# ============ Model Admins ============

@admin.register(RFP)
class RFPAdmin(admin.ModelAdmin):
    """Admin configuration for RFP."""

    list_display = [
        'number',
        'title',
        'organization',
        'status',
        'rfp_type',
        'estimated_value',
        'response_deadline',
        'proposal_count',
        'awarded_supplier',
    ]
    list_filter = [
        'status',
        'rfp_type',
        'bidding_type',
        'visibility',
        'organization',
    ]
    search_fields = [
        'number',
        'title',
        'description',
        'awarded_supplier__name',
    ]
    readonly_fields = [
        'number',
        'status',
        'publish_date',
        'evaluation_start_date',
        'awarded_date',
        'total_section_weight',
        'created_at',
        'updated_at',
    ]
    inlines = [
        RFPSectionInline,
        RFPLineItemInline,
        ScoringCriteriaInline,
        RFPInvitationInline,
        EvaluationTeamInline,
        BAFORoundInline,
        RFPQAInline,
    ]
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': (
                'number',
                'organization',
                'created_by',
                'title',
                'description',
                'status',
            )
        }),
        ('RFP Details', {
            'fields': (
                'rfp_type',
                'bidding_type',
                'visibility',
                'estimated_value',
            )
        }),
        ('Timeline', {
            'fields': (
                'publish_date',
                'question_deadline',
                'response_deadline',
                'evaluation_start_date',
                'award_target_date',
            )
        }),
        ('Scoring', {
            'fields': (
                'total_section_weight',
            ),
        }),
        ('Award Information', {
            'fields': (
                'awarded_supplier',
                'awarded_proposal',
                'awarded_date',
            ),
            'classes': ('collapse',),
        }),
        ('Related Records', {
            'fields': ('requisition',),
            'classes': ('collapse',),
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def proposal_count(self, obj):
        """Display proposal count."""
        return obj.proposals.count()
    proposal_count.short_description = 'Proposals'


@admin.register(RFPSection)
class RFPSectionAdmin(admin.ModelAdmin):
    """Admin configuration for RFPSection."""

    list_display = [
        'rfp',
        'section_number',
        'title',
        'section_type',
        'weight',
        'is_scorable',
        'question_count',
    ]
    list_filter = ['section_type', 'is_scorable', 'rfp__organization']
    search_fields = [
        'rfp__number',
        'title',
        'instructions',
    ]
    readonly_fields = ['section_number', 'created_at', 'updated_at']
    inlines = [RFPQuestionInline]

    def question_count(self, obj):
        """Display question count."""
        return obj.questions.count()
    question_count.short_description = 'Questions'


@admin.register(RFPQuestion)
class RFPQuestionAdmin(admin.ModelAdmin):
    """Admin configuration for RFPQuestion."""

    list_display = [
        'section',
        'question_number',
        'question_text_short',
        'question_type',
        'is_required',
        'max_score',
    ]
    list_filter = ['question_type', 'is_required', 'section__rfp__organization']
    search_fields = [
        'section__rfp__number',
        'question_text',
    ]
    readonly_fields = ['question_number', 'created_at', 'updated_at']

    def question_text_short(self, obj):
        """Display truncated question text."""
        return obj.question_text[:50] + '...' if len(obj.question_text) > 50 else obj.question_text
    question_text_short.short_description = 'Question'


@admin.register(RFPLineItem)
class RFPLineItemAdmin(admin.ModelAdmin):
    """Admin configuration for RFPLineItem."""

    list_display = [
        'rfp',
        'line_number',
        'description',
        'quantity',
        'unit_of_measure',
        'target_unit_price',
        'extended_amount',
    ]
    list_filter = ['unit_of_measure', 'rfp__organization']
    search_fields = [
        'rfp__number',
        'description',
        'catalog_item__name',
    ]
    readonly_fields = ['line_number', 'extended_amount', 'created_at', 'updated_at']


@admin.register(ScoringCriteria)
class ScoringCriteriaAdmin(admin.ModelAdmin):
    """Admin configuration for ScoringCriteria."""

    list_display = [
        'rfp',
        'name',
        'weight',
        'max_score',
        'section',
        'parent',
    ]
    list_filter = ['rfp__organization']
    search_fields = [
        'rfp__number',
        'name',
        'description',
    ]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(RFPInvitation)
class RFPInvitationAdmin(admin.ModelAdmin):
    """Admin configuration for RFPInvitation."""

    list_display = [
        'rfp',
        'supplier',
        'status',
        'intent_to_bid',
        'invited_by',
        'invited_at',
        'viewed_at',
    ]
    list_filter = ['status', 'intent_to_bid', 'rfp__organization']
    search_fields = [
        'rfp__number',
        'supplier__name',
    ]
    readonly_fields = [
        'invited_at',
        'viewed_at',
        'responded_at',
        'created_at',
        'updated_at',
    ]


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    """Admin configuration for Proposal."""

    list_display = [
        'proposal_number',
        'rfp',
        'supplier',
        'status',
        'overall_score',
        'rank',
        'total_amount',
        'submitted_at',
    ]
    list_filter = ['status', 'is_latest', 'rfp__organization']
    search_fields = [
        'proposal_number',
        'rfp__number',
        'supplier__name',
    ]
    readonly_fields = [
        'proposal_number',
        'status',
        'submitted_at',
        'technical_score',
        'management_score',
        'pricing_score',
        'overall_score',
        'rank',
        'total_amount',
        'created_at',
        'updated_at',
    ]
    inlines = [
        ProposalSectionInline,
        QuestionResponseInline,
        ProposalLineItemInline,
        EvaluationScoreInline,
    ]
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': (
                'proposal_number',
                'rfp',
                'supplier',
                'submitted_by',
                'status',
            )
        }),
        ('Scores', {
            'fields': (
                'technical_score',
                'management_score',
                'pricing_score',
                'overall_score',
                'rank',
            ),
        }),
        ('Financial', {
            'fields': (
                'total_amount',
                'valid_until',
            ),
        }),
        ('Version Control', {
            'fields': (
                'revision_number',
                'is_latest',
            ),
            'classes': ('collapse',),
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('submitted_at', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(ProposalSection)
class ProposalSectionAdmin(admin.ModelAdmin):
    """Admin configuration for ProposalSection."""

    list_display = [
        'proposal',
        'rfp_section',
        'section_score',
    ]
    list_filter = ['proposal__rfp__organization']
    search_fields = [
        'proposal__proposal_number',
        'rfp_section__title',
    ]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(QuestionResponse)
class QuestionResponseAdmin(admin.ModelAdmin):
    """Admin configuration for QuestionResponse."""

    list_display = [
        'proposal',
        'question',
        'answer_text_short',
    ]
    list_filter = ['question__question_type', 'proposal__rfp__organization']
    search_fields = [
        'proposal__proposal_number',
        'answer_text',
    ]
    readonly_fields = ['created_at', 'updated_at']

    def answer_text_short(self, obj):
        """Display truncated answer."""
        return obj.answer_text[:50] + '...' if len(obj.answer_text) > 50 else obj.answer_text
    answer_text_short.short_description = 'Answer'


@admin.register(ProposalLineItem)
class ProposalLineItemAdmin(admin.ModelAdmin):
    """Admin configuration for ProposalLineItem."""

    list_display = [
        'proposal',
        'rfp_line_item',
        'quantity',
        'unit_price',
        'extended_price',
        'lead_time_days',
    ]
    list_filter = ['proposal__rfp__organization']
    search_fields = [
        'proposal__proposal_number',
        'rfp_line_item__description',
        'manufacturer',
        'part_number',
    ]
    readonly_fields = ['extended_price', 'created_at', 'updated_at']


@admin.register(EvaluationTeam)
class EvaluationTeamAdmin(admin.ModelAdmin):
    """Admin configuration for EvaluationTeam."""

    list_display = [
        'rfp',
        'evaluator',
        'role',
        'assigned_by',
        'assigned_at',
    ]
    list_filter = ['role', 'rfp__organization']
    search_fields = [
        'rfp__number',
        'evaluator__email',
        'evaluator__first_name',
        'evaluator__last_name',
    ]
    readonly_fields = ['assigned_at', 'created_at', 'updated_at']
    filter_horizontal = ['assigned_sections']


@admin.register(EvaluationScore)
class EvaluationScoreAdmin(admin.ModelAdmin):
    """Admin configuration for EvaluationScore."""

    list_display = [
        'proposal',
        'evaluator',
        'criteria',
        'score',
        'max_score',
        'score_percentage',
        'is_final',
        'scored_at',
    ]
    list_filter = ['is_final', 'proposal__rfp__organization']
    search_fields = [
        'proposal__proposal_number',
        'evaluator__email',
        'comments',
    ]
    readonly_fields = ['score_percentage', 'scored_at', 'created_at', 'updated_at']


@admin.register(BAFORound)
class BAFORoundAdmin(admin.ModelAdmin):
    """Admin configuration for BAFORound."""

    list_display = [
        'rfp',
        'round_number',
        'status',
        'deadline',
        'opened_at',
        'closed_at',
        'response_count',
    ]
    list_filter = ['status', 'rfp__organization']
    search_fields = [
        'rfp__number',
        'instructions',
    ]
    readonly_fields = [
        'round_number',
        'opened_at',
        'closed_at',
        'created_at',
        'updated_at',
    ]
    inlines = [BAFOResponseInline]

    def response_count(self, obj):
        """Display response count."""
        return obj.responses.count()
    response_count.short_description = 'Responses'


@admin.register(BAFOResponse)
class BAFOResponseAdmin(admin.ModelAdmin):
    """Admin configuration for BAFOResponse."""

    list_display = [
        'bafo_round',
        'proposal',
        'status',
        'submitted_at',
    ]
    list_filter = ['status', 'bafo_round__rfp__organization']
    search_fields = [
        'bafo_round__rfp__number',
        'proposal__proposal_number',
    ]
    readonly_fields = ['submitted_at', 'created_at', 'updated_at']


@admin.register(RFPQA)
class RFPQAAdmin(admin.ModelAdmin):
    """Admin configuration for RFPQA."""

    list_display = [
        'rfp',
        'supplier',
        'asked_by',
        'question_short',
        'visibility',
        'is_published',
        'answered_at',
    ]
    list_filter = ['visibility', 'is_published', 'rfp__organization']
    search_fields = [
        'rfp__number',
        'question',
        'answer',
    ]
    readonly_fields = ['answered_at', 'created_at', 'updated_at']

    def question_short(self, obj):
        """Display truncated question."""
        return obj.question[:50] + '...' if len(obj.question) > 50 else obj.question
    question_short.short_description = 'Question'

"""
Contract service layer for business logic.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.core.exceptions import (
    ContractExpiredError,
    ContractNotActiveError,
    SpendLimitExceededError,
)

from .models import Contract, ContractLine, ContractMilestone, ContractSpend


class ContractService:
    """Service class for contract-related operations."""

    @staticmethod
    def create_contract(
        organization,
        supplier,
        created_by,
        title: str,
        contract_type: str = 'BLANKET',
        description: str = '',
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        total_value: Decimal = Decimal('0.00'),
        currency: str = 'USD',
        payment_terms: str = 'NET30',
        auto_renew: bool = False,
        renewal_notice_days: int = 30,
        terms_and_conditions: str = '',
        rfq=None,
        **kwargs,
    ) -> Contract:
        """Create a new contract."""
        contract = Contract.objects.create(
            organization=organization,
            supplier=supplier,
            created_by=created_by,
            title=title,
            contract_type=contract_type,
            description=description,
            start_date=start_date,
            end_date=end_date,
            total_value=total_value,
            currency=currency,
            payment_terms=payment_terms,
            auto_renew=auto_renew,
            renewal_notice_days=renewal_notice_days,
            terms_and_conditions=terms_and_conditions,
            rfq=rfq,
            **kwargs,
        )
        return contract

    @staticmethod
    def add_line(
        contract: Contract,
        description: str,
        unit_price: Decimal,
        unit_of_measure: str = 'EA',
        catalog_item=None,
        min_quantity: Optional[Decimal] = None,
        max_quantity: Optional[Decimal] = None,
        valid_from: Optional[date] = None,
        valid_to: Optional[date] = None,
        notes: str = '',
    ) -> ContractLine:
        """Add a line item to a contract."""
        return ContractLine.objects.create(
            contract=contract,
            description=description,
            unit_price=unit_price,
            unit_of_measure=unit_of_measure,
            catalog_item=catalog_item,
            min_quantity=min_quantity,
            max_quantity=max_quantity,
            valid_from=valid_from,
            valid_to=valid_to,
            notes=notes,
        )

    @staticmethod
    def add_milestone(
        contract: Contract,
        title: str,
        due_date: date,
        description: str = '',
        amount: Optional[Decimal] = None,
        notes: str = '',
    ) -> ContractMilestone:
        """Add a milestone to a contract."""
        return ContractMilestone.objects.create(
            contract=contract,
            title=title,
            due_date=due_date,
            description=description,
            amount=amount,
            notes=notes,
        )

    @staticmethod
    def record_spend(
        contract: Contract,
        purchase_order,
        amount: Decimal,
        notes: str = '',
        validate: bool = True,
    ) -> ContractSpend:
        """
        Record spend against a contract.

        Args:
            contract: The contract to record spend against
            purchase_order: The PO that triggered the spend
            amount: The spend amount
            notes: Optional notes
            validate: Whether to validate contract status and limits

        Returns:
            ContractSpend record

        Raises:
            ContractNotActiveError: If contract is not active
            ContractExpiredError: If contract has expired
            SpendLimitExceededError: If spend would exceed remaining value
        """
        if validate:
            if contract.status != 'ACTIVE':
                raise ContractNotActiveError(
                    contract_number=contract.number,
                    status=contract.status,
                )

            if contract.is_expired:
                raise ContractExpiredError(
                    contract_number=contract.number,
                    end_date=str(contract.end_date),
                )

            if amount > contract.remaining_value:
                raise SpendLimitExceededError(
                    contract_number=contract.number,
                    requested=float(amount),
                    remaining=float(contract.remaining_value),
                )

        spend, created = ContractSpend.objects.update_or_create(
            contract=contract,
            purchase_order=purchase_order,
            defaults={
                'amount': amount,
                'notes': notes,
            },
        )
        return spend

    @staticmethod
    def get_expiring_contracts(
        organization,
        days: int = 30,
    ) -> QuerySet[Contract]:
        """Get contracts expiring within N days."""
        today = timezone.now().date()
        end_threshold = today + timezone.timedelta(days=days)

        return Contract.objects.filter(
            organization=organization,
            status='ACTIVE',
            end_date__gte=today,
            end_date__lte=end_threshold,
        ).order_by('end_date')

    @staticmethod
    def get_contracts_for_supplier(
        organization,
        supplier,
        active_only: bool = True,
    ) -> QuerySet[Contract]:
        """Get all contracts for a supplier."""
        qs = Contract.objects.filter(
            organization=organization,
            supplier=supplier,
        )
        if active_only:
            qs = qs.filter(status='ACTIVE')
        return qs.order_by('-created_at')

    @staticmethod
    def get_active_contract_for_item(
        organization,
        catalog_item,
    ) -> Optional[Contract]:
        """Find active contract with pricing for a catalog item."""
        today = timezone.now().date()

        contract_line = ContractLine.objects.filter(
            contract__organization=organization,
            contract__status='ACTIVE',
            catalog_item=catalog_item,
            is_active=True,
        ).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=today),
            Q(valid_to__isnull=True) | Q(valid_to__gte=today),
        ).select_related('contract').first()

        return contract_line.contract if contract_line else None

    @staticmethod
    def get_contract_pricing(
        contract: Contract,
        catalog_item=None,
        description: str = None,
    ) -> Optional[ContractLine]:
        """Get applicable contract pricing for an item."""
        today = timezone.now().date()

        qs = contract.lines.filter(is_active=True).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=today),
            Q(valid_to__isnull=True) | Q(valid_to__gte=today),
        )

        if catalog_item:
            qs = qs.filter(catalog_item=catalog_item)
        elif description:
            qs = qs.filter(description__icontains=description)

        return qs.first()

    @staticmethod
    def check_expiry_and_update_status(contract: Contract) -> bool:
        """
        Check if contract should be marked expired.

        Returns True if status was changed.
        """
        if contract.status == 'ACTIVE' and contract.is_expired:
            contract.expire()
            return True
        return False

    @staticmethod
    def get_overdue_milestones(
        organization=None,
        contract: Contract = None,
    ) -> QuerySet[ContractMilestone]:
        """Get overdue milestones."""
        today = timezone.now().date()

        qs = ContractMilestone.objects.filter(
            status='PENDING',
            due_date__lt=today,
        )

        if organization:
            qs = qs.filter(contract__organization=organization)
        if contract:
            qs = qs.filter(contract=contract)

        return qs.select_related('contract').order_by('due_date')

    @staticmethod
    def get_spend_summary(contract: Contract) -> dict:
        """Get spend summary for a contract."""
        return {
            'contract_number': contract.number,
            'total_value': contract.total_value,
            'total_spent': contract.total_spent,
            'remaining_value': contract.remaining_value,
            'utilization_percent': contract.utilization_percent,
            'spend_count': contract.spend_records.count(),
        }

    @staticmethod
    def create_amendment(
        original_contract: Contract,
        created_by,
        new_end_date: Optional[date] = None,
        new_total_value: Optional[Decimal] = None,
        copy_lines: bool = True,
    ) -> Contract:
        """
        Create an amendment to an existing contract.

        Creates a new contract linked to the original.
        """
        amendment = Contract.objects.create(
            organization=original_contract.organization,
            supplier=original_contract.supplier,
            created_by=created_by,
            title=f'{original_contract.title} (Amendment {original_contract.amendment_number + 1})',
            description=original_contract.description,
            contract_type=original_contract.contract_type,
            start_date=timezone.now().date(),
            end_date=new_end_date or original_contract.end_date,
            total_value=new_total_value or original_contract.total_value,
            currency=original_contract.currency,
            payment_terms=original_contract.payment_terms,
            auto_renew=original_contract.auto_renew,
            renewal_notice_days=original_contract.renewal_notice_days,
            terms_and_conditions=original_contract.terms_and_conditions,
            parent_contract=original_contract,
            amendment_number=original_contract.amendment_number + 1,
        )

        if copy_lines:
            for line in original_contract.lines.filter(is_active=True):
                ContractLine.objects.create(
                    contract=amendment,
                    description=line.description,
                    catalog_item=line.catalog_item,
                    unit_of_measure=line.unit_of_measure,
                    unit_price=line.unit_price,
                    min_quantity=line.min_quantity,
                    max_quantity=line.max_quantity,
                    notes=line.notes,
                )

        return amendment

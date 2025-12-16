"""
Tests for core exceptions.
"""

import pytest

from apps.core.exceptions import (
    InvalidStateTransitionError,
    InsufficientBudgetError,
    ProcurementPlatformError,
)


class TestProcurementPlatformError:
    """Tests for base exception class."""

    def test_is_exception_subclass(self):
        """Base error should be an Exception subclass."""
        assert issubclass(ProcurementPlatformError, Exception)

    def test_can_be_raised_with_message(self):
        """Base error should accept a message."""
        with pytest.raises(ProcurementPlatformError, match="Test error message"):
            raise ProcurementPlatformError("Test error message")


class TestInvalidStateTransitionError:
    """Tests for InvalidStateTransitionError."""

    def test_inherits_from_base_error(self):
        """Should inherit from ProcurementPlatformError."""
        assert issubclass(InvalidStateTransitionError, ProcurementPlatformError)

    def test_stores_transition_details(self):
        """Should store from_state, to_state, and entity info."""
        error = InvalidStateTransitionError(
            from_state="PENDING",
            to_state="APPROVED",
            entity="Supplier",
        )
        assert error.from_state == "PENDING"
        assert error.to_state == "APPROVED"
        assert error.entity == "Supplier"

    def test_generates_descriptive_message(self):
        """Should generate a clear error message."""
        error = InvalidStateTransitionError(
            from_state="DRAFT",
            to_state="CLOSED",
            entity="Requisition",
        )
        message = str(error)
        assert "DRAFT" in message
        assert "CLOSED" in message
        assert "Requisition" in message

    def test_can_be_raised_and_caught(self):
        """Should be raisable and catchable."""
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            raise InvalidStateTransitionError(
                from_state="A",
                to_state="B",
                entity="Test",
            )
        assert exc_info.value.from_state == "A"
        assert exc_info.value.to_state == "B"


class TestInsufficientBudgetError:
    """Tests for InsufficientBudgetError."""

    def test_inherits_from_base_error(self):
        """Should inherit from ProcurementPlatformError."""
        assert issubclass(InsufficientBudgetError, ProcurementPlatformError)

    def test_stores_budget_details(self):
        """Should store requested, available, and budget_line info."""
        error = InsufficientBudgetError(
            requested=10000.00,
            available=5000.00,
            budget_line="IT-2025-001",
        )
        assert error.requested == 10000.00
        assert error.available == 5000.00
        assert error.budget_line == "IT-2025-001"

    def test_calculates_shortfall(self):
        """Should calculate the shortfall amount."""
        error = InsufficientBudgetError(
            requested=10000.00,
            available=3500.00,
            budget_line="HR-2025-002",
        )
        assert error.shortfall == 6500.00

    def test_generates_descriptive_message(self):
        """Should generate a clear error message with amounts."""
        error = InsufficientBudgetError(
            requested=25000.00,
            available=20000.00,
            budget_line="MKTG-001",
        )
        message = str(error)
        assert "25000" in message or "25,000" in message
        assert "20000" in message or "20,000" in message
        assert "MKTG-001" in message

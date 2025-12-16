"""
Django signals for contract-related events.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


# Note: Signal to auto-record spend when PO is approved will be added
# after the PurchaseOrder model is modified to include contract FK.
# For now, spend recording is handled manually via ContractService.record_spend()

# Placeholder for future implementation:
# @receiver(post_save, sender='purchase_orders.PurchaseOrder')
# def record_contract_spend_on_po_approval(sender, instance, **kwargs):
#     """Record spend when a PO linked to a contract is approved."""
#     if instance.contract and instance.status == 'APPROVED':
#         from .services import ContractService
#         try:
#             ContractService.record_spend(
#                 contract=instance.contract,
#                 purchase_order=instance,
#                 amount=instance.total_amount,
#                 validate=True,
#             )
#         except Exception as e:
#             logger.error(f"Failed to record contract spend for PO {instance.number}: {e}")

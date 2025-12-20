"""
Load Testing for Dillanci Procurement Platform

Uses Locust to simulate realistic user behavior and test system performance.

Run with:
    locust -f tests/load/locustfile.py --host=http://localhost:8000

Web UI available at http://localhost:8089
"""

import random
import string
from locust import HttpUser, task, between, tag


def random_string(length=8):
    """Generate a random string for test data."""
    return ''.join(random.choices(string.ascii_lowercase, k=length))


class ProcurementUser(HttpUser):
    """
    Simulates a typical procurement user interacting with the system.

    Weighted tasks represent realistic usage patterns:
    - Viewing dashboards and lists is most common
    - Creating/updating records is less frequent
    - Admin operations are rare
    """

    # Wait between 1-3 seconds between tasks (realistic user behavior)
    wait_time = between(1, 3)

    # Store auth token for authenticated requests
    token = None
    csrf_token = None

    def on_start(self):
        """Login when user starts."""
        # Get CSRF token first
        response = self.client.get("/api/v1/health/")

        # Login as test user
        response = self.client.post(
            "/api/v1/auth/login/",
            json={
                "email": "admin@dillanci.com",
                "password": "adminpassword123"
            },
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            # Session-based auth, cookies are handled automatically
            pass

    # =========================================================================
    # Dashboard & Health (High frequency - 40% of traffic)
    # =========================================================================

    @task(10)
    @tag("dashboard", "read")
    def view_dashboard(self):
        """View the main dashboard."""
        self.client.get("/api/v1/reports/dashboard/kpis/")

    @task(5)
    @tag("health", "read")
    def health_check(self):
        """Check system health."""
        self.client.get("/api/v1/health/")

    @task(3)
    @tag("health", "read")
    def detailed_health_check(self):
        """Check detailed system health."""
        self.client.get("/api/v1/health/detailed/")

    # =========================================================================
    # Requisitions (High frequency - 25% of traffic)
    # =========================================================================

    @task(8)
    @tag("requisitions", "read")
    def list_requisitions(self):
        """View list of requisitions."""
        self.client.get("/api/v1/requisitions/")

    @task(5)
    @tag("requisitions", "read")
    def list_requisitions_with_filters(self):
        """View filtered requisitions."""
        status = random.choice(["DRAFT", "PENDING", "APPROVED", "REJECTED"])
        self.client.get(f"/api/v1/requisitions/?status={status}")

    @task(2)
    @tag("requisitions", "read")
    def view_requisition_detail(self):
        """View a specific requisition."""
        # Get list first, then view detail
        response = self.client.get("/api/v1/requisitions/?limit=10")
        if response.status_code == 200 and response.json().get("results"):
            req_id = response.json()["results"][0]["id"]
            self.client.get(f"/api/v1/requisitions/{req_id}/")

    # =========================================================================
    # Purchase Orders (Medium frequency - 15% of traffic)
    # =========================================================================

    @task(5)
    @tag("purchase_orders", "read")
    def list_purchase_orders(self):
        """View list of purchase orders."""
        self.client.get("/api/v1/purchase-orders/")

    @task(2)
    @tag("purchase_orders", "read")
    def view_purchase_order_detail(self):
        """View a specific purchase order."""
        response = self.client.get("/api/v1/purchase-orders/?limit=10")
        if response.status_code == 200 and response.json().get("results"):
            po_id = response.json()["results"][0]["id"]
            self.client.get(f"/api/v1/purchase-orders/{po_id}/")

    # =========================================================================
    # Suppliers (Medium frequency - 10% of traffic)
    # =========================================================================

    @task(4)
    @tag("suppliers", "read")
    def list_suppliers(self):
        """View list of suppliers."""
        self.client.get("/api/v1/suppliers/")

    @task(2)
    @tag("suppliers", "read")
    def search_suppliers(self):
        """Search for suppliers."""
        search_term = random.choice(["tech", "supply", "corp", "inc"])
        self.client.get(f"/api/v1/suppliers/?search={search_term}")

    # =========================================================================
    # Invoices (Medium frequency - 5% of traffic)
    # =========================================================================

    @task(3)
    @tag("invoices", "read")
    def list_invoices(self):
        """View list of invoices."""
        self.client.get("/api/v1/invoices/")

    @task(1)
    @tag("invoices", "read")
    def list_invoices_by_status(self):
        """View invoices by matching status."""
        status = random.choice(["PENDING", "MATCHED", "PARTIALLY_MATCHED", "UNMATCHED"])
        self.client.get(f"/api/v1/invoices/?match_status={status}")

    # =========================================================================
    # RFQs & RFPs (Low frequency - 5% of traffic)
    # =========================================================================

    @task(2)
    @tag("rfqs", "read")
    def list_rfqs(self):
        """View list of RFQs."""
        self.client.get("/api/v1/rfqs/")

    @task(2)
    @tag("rfps", "read")
    def list_rfps(self):
        """View list of RFPs."""
        self.client.get("/api/v1/rfps/")


class AdminUser(HttpUser):
    """
    Simulates an admin user performing administrative tasks.

    Lower traffic, but more intensive operations.
    """

    wait_time = between(2, 5)
    weight = 1  # 1 admin per 10 regular users

    def on_start(self):
        """Login as admin."""
        self.client.post(
            "/api/v1/auth/login/",
            json={
                "email": "admin@dillanci.com",
                "password": "adminpassword123"
            },
            headers={"Content-Type": "application/json"}
        )

    @task(5)
    @tag("admin", "read")
    def list_users(self):
        """View list of users."""
        self.client.get("/api/v1/users/")

    @task(3)
    @tag("admin", "read")
    def view_audit_logs(self):
        """View audit logs."""
        self.client.get("/api/v1/audit/")

    @task(2)
    @tag("admin", "read")
    def view_reports(self):
        """View reports dashboard."""
        self.client.get("/api/v1/reports/spend/")

    @task(1)
    @tag("admin", "read")
    def view_budget_summary(self):
        """View budget summary."""
        self.client.get("/api/v1/budget/summary/")


class GuestUser(HttpUser):
    """
    Simulates unauthenticated traffic (health checks, public endpoints).
    """

    wait_time = between(1, 2)
    weight = 2  # More guest traffic than admin

    @task(10)
    @tag("public", "health")
    def health_check(self):
        """Check basic health."""
        self.client.get("/api/v1/health/")

    @task(5)
    @tag("public", "health")
    def liveness_check(self):
        """Check liveness probe."""
        self.client.get("/api/v1/health/live/")

    @task(5)
    @tag("public", "health")
    def readiness_check(self):
        """Check readiness probe."""
        self.client.get("/api/v1/health/ready/")

import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  FileQuestion,
  ShoppingCart,
  Package,
  Receipt,
  Users,
  FileSignature,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCog,
  GitBranch,
  ClipboardList,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { usePermissions } from '@/hooks/usePermissions';
import { Permissions } from '@/types';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  /** Permission required to see this nav item */
  permission?: string;
  /** Multiple permissions - user needs ANY of these to see this item */
  anyPermission?: string[];
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, href: '/dashboard' },
  {
    label: 'Requisitions',
    icon: <FileText className="h-5 w-5" />,
    href: '/requisitions',
    anyPermission: [Permissions.REQUISITION_VIEW, Permissions.REQUISITION_CREATE],
  },
  {
    label: 'RFQs',
    icon: <FileQuestion className="h-5 w-5" />,
    href: '/rfqs',
    anyPermission: [Permissions.RFQ_VIEW, Permissions.RFQ_CREATE],
  },
  {
    label: 'RFPs',
    icon: <FileSignature className="h-5 w-5" />,
    href: '/rfps',
    anyPermission: [Permissions.RFP_VIEW, Permissions.RFP_CREATE],
  },
  {
    label: 'Purchase Orders',
    icon: <ShoppingCart className="h-5 w-5" />,
    href: '/purchase-orders',
    anyPermission: [Permissions.PO_VIEW, Permissions.PO_CREATE],
  },
  {
    label: 'Receiving',
    icon: <Package className="h-5 w-5" />,
    href: '/receiving',
    anyPermission: [Permissions.RECEIVING_VIEW, Permissions.RECEIVING_CREATE],
  },
  {
    label: 'Invoices',
    icon: <Receipt className="h-5 w-5" />,
    href: '/invoices',
    anyPermission: [Permissions.INVOICE_VIEW, Permissions.INVOICE_CREATE],
  },
  {
    label: 'Suppliers',
    icon: <Users className="h-5 w-5" />,
    href: '/suppliers',
    anyPermission: [Permissions.SUPPLIER_VIEW, Permissions.SUPPLIER_CREATE],
  },
  {
    label: 'Supplier Performance',
    icon: <TrendingUp className="h-5 w-5" />,
    href: '/suppliers/performance',
    anyPermission: [Permissions.SUPPLIER_VIEW, Permissions.REPORT_VIEW],
  },
  {
    label: 'Contracts',
    icon: <FileSignature className="h-5 w-5" />,
    href: '/contracts',
    anyPermission: [Permissions.CONTRACT_VIEW, Permissions.CONTRACT_CREATE],
  },
  {
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    href: '/reports',
    permission: Permissions.REPORT_VIEW,
  },
];

const adminNavItems: NavItem[] = [
  {
    label: 'Users',
    icon: <UserCog className="h-5 w-5" />,
    href: '/admin/users',
    anyPermission: [Permissions.USER_VIEW, Permissions.USER_ASSIGN_ROLES],
  },
  {
    label: 'Roles',
    icon: <Shield className="h-5 w-5" />,
    href: '/admin/roles',
    permission: Permissions.ADMIN_MANAGE_ROLES,
  },
  {
    label: 'Workflows',
    icon: <GitBranch className="h-5 w-5" />,
    href: '/admin/workflows',
    permission: Permissions.ORG_MANAGE_SETTINGS,
  },
  {
    label: 'Audit Logs',
    icon: <ClipboardList className="h-5 w-5" />,
    href: '/admin/audit-logs',
    permission: Permissions.AUDIT_VIEW,
  },
  {
    label: 'Organization',
    icon: <Building2 className="h-5 w-5" />,
    href: '/admin/organization',
    anyPermission: [Permissions.ORG_VIEW, Permissions.ORG_EDIT],
  },
];

const bottomNavItems: NavItem[] = [
  { label: 'Settings', icon: <Settings className="h-5 w-5" />, href: '/settings' },
];

function NavItemComponent({ item, sidebarCollapsed }: { item: NavItem; sidebarCollapsed: boolean }) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          'hover:bg-neutral-100',
          isActive
            ? 'bg-primary-50 text-primary-700 font-medium'
            : 'text-neutral-600'
        )
      }
    >
      <span className="flex-shrink-0">{item.icon}</span>
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="whitespace-nowrap overflow-hidden text-sm"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {item.badge && !sidebarCollapsed && (
        <span className="ml-auto bg-primary-100 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { hasPermission, hasAnyPermission, isAdmin, isSuperuser } = usePermissions();

  // Helper to check if nav item should be visible
  const canViewNavItem = (item: NavItem): boolean => {
    // Superusers can see everything
    if (isSuperuser) return true;

    // If no permission required, show to everyone
    if (!item.permission && !item.anyPermission) return true;

    // Check single permission
    if (item.permission && hasPermission(item.permission)) return true;

    // Check any permission
    if (item.anyPermission && hasAnyPermission(item.anyPermission)) return true;

    return false;
  };

  // Filter nav items based on permissions
  const visibleMainNavItems = mainNavItems.filter(canViewNavItem);
  const visibleAdminNavItems = adminNavItems.filter(canViewNavItem);

  // Show admin section if user is admin AND has at least one visible admin item
  const showAdminSection = isAdmin && visibleAdminNavItems.length > 0;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-white border-r border-neutral-200 z-40 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-3 border-b border-neutral-200">
        <AnimatePresence mode="wait">
          {sidebarCollapsed ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="w-10 h-10 flex items-center justify-center"
            >
              <img src="/images/icon.svg" alt="Dillanci" className="w-10 h-10" />
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center"
            >
              <img src="/images/logo-full.svg" alt="Dillanci" className="h-10 w-auto" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
        {/* Main navigation */}
        <ul className="space-y-1">
          {visibleMainNavItems.map((item) => (
            <li key={item.href}>
              <NavItemComponent item={item} sidebarCollapsed={sidebarCollapsed} />
            </li>
          ))}
        </ul>

        {/* Admin section */}
        {showAdminSection && (
          <div className="mt-6">
            {/* Section divider */}
            <div className="px-3 mb-2">
              <AnimatePresence>
                {!sidebarCollapsed ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <div className="h-px flex-1 bg-neutral-200" />
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                      Admin
                    </span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-px bg-neutral-200"
                  />
                )}
              </AnimatePresence>
            </div>
            <ul className="space-y-1">
              {visibleAdminNavItems.map((item) => (
                <li key={item.href}>
                  <NavItemComponent item={item} sidebarCollapsed={sidebarCollapsed} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-neutral-200 py-4 px-2">
        <ul className="space-y-1">
          {bottomNavItems.map((item) => (
            <li key={item.href}>
              <NavItemComponent item={item} sidebarCollapsed={sidebarCollapsed} />
            </li>
          ))}
        </ul>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-neutral-200 rounded-full flex items-center justify-center shadow-sm hover:bg-neutral-50 transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-neutral-500" />
        )}
      </button>
    </motion.aside>
  );
}

export default Sidebar;

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, href: '/dashboard' },
  { label: 'Requisitions', icon: <FileText className="h-5 w-5" />, href: '/requisitions' },
  { label: 'RFQs', icon: <FileQuestion className="h-5 w-5" />, href: '/rfqs' },
  { label: 'RFPs', icon: <FileSignature className="h-5 w-5" />, href: '/rfps' },
  { label: 'Purchase Orders', icon: <ShoppingCart className="h-5 w-5" />, href: '/purchase-orders' },
  { label: 'Receiving', icon: <Package className="h-5 w-5" />, href: '/receiving' },
  { label: 'Invoices', icon: <Receipt className="h-5 w-5" />, href: '/invoices' },
  { label: 'Suppliers', icon: <Users className="h-5 w-5" />, href: '/suppliers' },
  { label: 'Contracts', icon: <FileSignature className="h-5 w-5" />, href: '/contracts' },
  { label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, href: '/reports' },
];

const bottomNavItems: NavItem[] = [
  { label: 'Settings', icon: <Settings className="h-5 w-5" />, href: '/settings' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

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
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center"
            >
              <span className="text-white font-bold text-lg">D</span>
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-primary-700 via-primary-500 to-primary-700 bg-clip-text text-transparent">
                Dillanci
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
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
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-neutral-200 py-4 px-2">
        <ul className="space-y-1">
          {bottomNavItems.map((item) => (
            <li key={item.href}>
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
              </NavLink>
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

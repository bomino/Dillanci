/**
 * Portal Layout - Main layout for supplier portal pages.
 *
 * Provides navigation, header, and responsive sidebar for portal users.
 */

import * as React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  FileText,
  FileStack,
  ShoppingCart,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePortalStore, usePortalUser, usePortalSupplier } from '@/stores/portal-store';
import { portalLogout } from '@/lib/api/portal';
import { toast } from 'sonner';

const navigation = [
  { name: 'Dashboard', href: '/portal', icon: Home, end: true },
  { name: 'RFQs', href: '/portal/rfqs', icon: FileText },
  { name: 'RFPs', href: '/portal/rfps', icon: FileStack },
  { name: 'Purchase Orders', href: '/portal/purchase-orders', icon: ShoppingCart },
  { name: 'Company Profile', href: '/portal/profile', icon: Building2 },
];

export default function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const navigate = useNavigate();

  const user = usePortalUser();
  const supplier = usePortalSupplier();
  const clearAuth = usePortalStore((state) => state.clearAuth);

  const handleLogout = async () => {
    try {
      await portalLogout();
      clearAuth();
      navigate('/portal/login');
      toast.success('You have been logged out successfully.');
    } catch {
      // Even if the API call fails, clear local auth
      clearAuth();
      navigate('/portal/login');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:transform-none lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200">
          <Link to="/portal" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <div>
              <span className="font-semibold text-neutral-900">Dillanci</span>
              <span className="text-xs text-neutral-500 block -mt-0.5">Supplier Portal</span>
            </div>
          </Link>
          <button
            className="lg:hidden p-2 text-neutral-500 hover:text-neutral-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                )
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Supplier info */}
        <div className="p-4 border-t border-neutral-200">
          <div className="px-3 py-2">
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Supplier</p>
            <p className="text-sm font-medium text-neutral-900 truncate">
              {supplier?.name || 'Loading...'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-neutral-200">
          <div className="h-full px-4 flex items-center justify-between">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 -ml-2 text-neutral-500 hover:text-neutral-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Page title placeholder */}
            <div className="hidden lg:block" />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-medium text-sm">
                      {user?.first_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-neutral-900">
                      {user?.full_name || 'Portal User'}
                    </p>
                    <p className="text-xs text-neutral-500">{user?.role}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-neutral-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/portal/profile" className="cursor-pointer">
                    <Building2 className="h-4 w-4 mr-2" />
                    Company Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Command,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { Button, Input } from '@/components/ui';

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, setCommandPaletteOpen } = useUIStore();
  const [notifications] = useState(3); // Mock notification count

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?';

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 bg-white border-b border-neutral-200 z-30 flex items-center justify-between px-6',
        'transition-all duration-200',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      {/* Search */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 w-64 px-3 py-2 text-sm text-neutral-400 bg-neutral-50 rounded-lg border border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto flex items-center gap-1 text-xs text-neutral-400 bg-white px-1.5 py-0.5 rounded border border-neutral-200">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-xs font-medium rounded-full flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {userInitials}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-neutral-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-neutral-500">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50"
              sideOffset={8}
              align="end"
            >
              <DropdownMenu.Label className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase">
                Account
              </DropdownMenu.Label>

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer outline-none"
                onSelect={() => navigate('/profile')}
              >
                <User className="h-4 w-4" />
                Profile
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer outline-none"
                onSelect={() => navigate('/settings')}
              >
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-neutral-200 my-1" />

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-red-50 cursor-pointer outline-none"
                onSelect={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

export default Header;

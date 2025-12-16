import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search, X, FileText, Users, ShoppingCart, Building2, History, Plus, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from './dialog';

// Command Context for sharing state
interface CommandContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

function useCommand() {
  const context = React.useContext(CommandContext);
  if (!context) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
}

// Base Command components
const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-lg bg-white',
      className
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-neutral-200 px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 text-neutral-400" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none',
        'placeholder:text-neutral-400',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-neutral-500"
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-neutral-700',
      '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
      '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
      '[&_[cmdk-group-heading]]:text-neutral-500',
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 h-px bg-neutral-200', className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none',
      'aria-selected:bg-primary-50 aria-selected:text-primary-900',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'hover:bg-neutral-100',
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'ml-auto text-xs tracking-widest text-neutral-400',
      className
    )}
    {...props}
  />
);
CommandShortcut.displayName = 'CommandShortcut';

// Main Command Palette Component
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  // Navigation items
  const navigationItems = [
    { name: 'Dashboard', icon: <Building2 className="h-4 w-4" />, path: '/dashboard' },
    { name: 'Requisitions', icon: <FileText className="h-4 w-4" />, path: '/requisitions' },
    { name: 'RFQs', icon: <FileText className="h-4 w-4" />, path: '/rfqs' },
    { name: 'RFPs', icon: <FileText className="h-4 w-4" />, path: '/rfps' },
    { name: 'Purchase Orders', icon: <ShoppingCart className="h-4 w-4" />, path: '/purchase-orders' },
    { name: 'Suppliers', icon: <Users className="h-4 w-4" />, path: '/suppliers' },
    { name: 'Contracts', icon: <FileText className="h-4 w-4" />, path: '/contracts' },
    { name: 'Invoices', icon: <FileText className="h-4 w-4" />, path: '/invoices' },
    { name: 'Reports', icon: <FileText className="h-4 w-4" />, path: '/reports' },
    { name: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/settings' },
  ];

  // Quick actions
  const quickActions = [
    { name: 'Create RFQ', icon: <Plus className="h-4 w-4" />, action: () => navigate('/rfqs/new') },
    { name: 'Create Purchase Order', icon: <Plus className="h-4 w-4" />, action: () => navigate('/purchase-orders/new') },
    { name: 'Add Supplier', icon: <Plus className="h-4 w-4" />, action: () => navigate('/suppliers/new') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg" size="lg" showCloseButton={false}>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-neutral-500">
          <CommandInput
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.name}
                  onSelect={() => runCommand(action.action)}
                >
                  {action.icon}
                  <span className="ml-2">{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navigation">
              {navigationItems.map((item) => (
                <CommandItem
                  key={item.path}
                  onSelect={() => runCommand(() => navigate(item.path))}
                >
                  {item.icon}
                  <span className="ml-2">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Recent">
              <CommandItem>
                <History className="mr-2 h-4 w-4" />
                <span>RFQ-2025-000058</span>
                <CommandShortcut>2h ago</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <History className="mr-2 h-4 w-4" />
                <span>PO-2025-000141</span>
                <CommandShortcut>4h ago</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500">
            <div className="flex gap-2">
              <span>↑↓ to navigate</span>
              <span>↵ to select</span>
              <span>esc to close</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium">
                ⌘
              </kbd>
              <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium">
                K
              </kbd>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Hook for keyboard shortcut
function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { open, setOpen };
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  CommandPalette,
  useCommandPalette,
};

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

// Create a new QueryClient for each test to prevent state leakage
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface ProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
}

/**
 * Wrapper with all providers needed for testing
 * Uses MemoryRouter for better control over routing in tests
 */
function AllProviders({ children, initialEntries = ['/'] }: ProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Wrapper with BrowserRouter for tests that need actual browser history
 */
function BrowserProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  useBrowserRouter?: boolean;
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { initialEntries, useBrowserRouter = false, ...renderOptions } = options;

  const Wrapper = useBrowserRouter
    ? BrowserProviders
    : ({ children }: { children: ReactNode }) => (
        <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
      );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    // Return the QueryClient for advanced testing scenarios
    queryClient: createTestQueryClient(),
  };
}

/**
 * Create a wrapper for testing hooks with React Query
 */
export function createQueryWrapper() {
  const queryClient = createTestQueryClient();

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Export the custom render as the default render
export { renderWithProviders as render };

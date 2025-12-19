/**
 * Portal Login Page - Authentication for supplier portal users.
 *
 * Styled to match the main Dillanci login page with animated background
 * and feature showcase for suppliers.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Loader2,
  FileText,
  ShoppingCart,
  Bell,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from '@/components/ui';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { usePortalStore, usePortalIsAuthenticated } from '@/stores/portal-store';
import { portalLogin } from '@/lib/api/portal';
import { toast } from 'sonner';
import * as React from 'react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Feature card component
interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon: Icon, title, description, delay }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-neutral-200/50 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-100/80">
          <Icon className="h-5 w-5 text-primary-700" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-800 text-sm">{title}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Supplier portal features
const features = [
  {
    icon: FileText,
    title: 'RFQ Response',
    description: 'Submit competitive bids',
  },
  {
    icon: ShoppingCart,
    title: 'Purchase Orders',
    description: 'View & acknowledge POs',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Real-time updates',
  },
  {
    icon: Building2,
    title: 'Company Profile',
    description: 'Manage your details',
  },
];

export default function PortalLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const setAuth = usePortalStore((state) => state.setAuth);
  const isAuthenticated = usePortalIsAuthenticated();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: string })?.from || '/portal';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await portalLogin(data.email, data.password);
      setAuth(response.user, response.supplier);
      toast.success(`Welcome back, ${response.user.full_name}!`);
      navigate('/portal');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="shadow-2xl border-primary-100/50 backdrop-blur-sm bg-white/95">
              <CardHeader className="space-y-1 text-center pb-2">
                {/* Logo */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="flex justify-center mb-4"
                >
                  <img
                    src="/images/logo-full.svg"
                    alt="Dillanci"
                    className="h-20 w-auto"
                  />
                </motion.div>
                <CardDescription className="text-neutral-500 text-base">
                  Supplier Portal
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Error message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Email field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" required>
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      error={errors.email?.message}
                      className="h-11"
                      {...register('email')}
                    />
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" required>
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        error={errors.password?.message}
                        className="h-11 pr-10"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit button */}
                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-neutral-500">
                      Don't have an account?
                    </span>
                  </div>
                </div>

                {/* Footer text */}
                <p className="text-center text-sm text-neutral-600">
                  Contact your buyer to request portal access
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Features Showcase */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={0.3 + index * 0.1}
              />
            ))}
          </div>

          {/* Back to main site */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center"
          >
            <Link
              to="/login"
              className="text-sm text-neutral-500 hover:text-primary-600 transition-colors"
            >
              ← Back to main site
            </Link>
          </motion.div>

          {/* Version info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-4 text-center text-xs text-neutral-400"
          >
            Dillanci Supplier Portal v1.0.0
          </motion.p>
        </div>
      </div>
    </div>
  );
}

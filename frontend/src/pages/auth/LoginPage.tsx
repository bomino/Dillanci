import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Loader2,
  FileText,
  CheckCircle,
  Users,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
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
import { getErrorMessage } from '@/lib/api/client';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
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

// Features data
const features = [
  {
    icon: FileText,
    title: 'Requisitions',
    description: 'Streamlined purchase requests',
  },
  {
    icon: CheckCircle,
    title: 'Smart Approvals',
    description: 'Role-based workflows',
  },
  {
    icon: Users,
    title: 'Supplier Hub',
    description: 'Complete vendor lifecycle',
  },
  {
    icon: BarChart3,
    title: 'Insights',
    description: 'Real-time analytics',
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login({ email: data.email, password: data.password });
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
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
                  Enterprise Sourcing & Procurement Platform
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

                  {/* Remember Me */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      {...register('rememberMe')}
                      className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-sm text-neutral-600 cursor-pointer font-normal"
                    >
                      Remember me
                    </Label>
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

                {/* Footer text */}
                <p className="mt-6 text-center text-sm text-neutral-500">
                  Need help?{' '}
                  <a
                    href="mailto:support@dillanci.com"
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Contact support
                  </a>
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

          {/* Version info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-neutral-400"
          >
            Dillanci v1.0.0
          </motion.p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

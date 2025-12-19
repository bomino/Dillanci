/**
 * Portal Register Page - Registration for new supplier portal users.
 *
 * Styled to match the main Dillanci login page with animated background.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
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
import { usePortalStore } from '@/stores/portal-store';
import { portalRegister, useValidateInvitation } from '@/lib/api/portal';
import { toast } from 'sonner';

const registerSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    password_confirm: z.string(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'Passwords do not match',
    path: ['password_confirm'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function PortalRegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');
  const setAuth = usePortalStore((state) => state.setAuth);

  // Validate invitation token
  const { data: invitation, isLoading: isValidating } = useValidateInvitation(token);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    if (!token) return;

    setError(null);
    setIsLoading(true);
    try {
      const response = await portalRegister(token, data);
      setAuth(response.user, response.supplier);
      toast.success('Welcome to the Dillanci Supplier Portal!');
      navigate('/portal');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid or missing token
  if (!token) {
    return (
      <InvalidInvitation
        title="Missing Invitation"
        message="No invitation token was provided. Please use the link from your invitation email."
      />
    );
  }

  if (isValidating) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
            <p className="text-neutral-600">Validating invitation...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!invitation?.valid) {
    return (
      <InvalidInvitation
        title={invitation?.error === 'expired' ? 'Invitation Expired' : 'Invalid Invitation'}
        message={invitation?.message || 'This invitation link is no longer valid.'}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          {/* Register Card */}
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
                  Create Your Account
                </CardDescription>
                <p className="text-sm text-neutral-600 pt-1">
                  Join <span className="font-medium text-primary-700">{invitation.supplier_name}</span>'s portal account
                </p>
              </CardHeader>

              <CardContent className="pt-4">
                {/* Invitation info */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200"
                >
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Valid Invitation</span>
                  </div>
                  <p className="mt-1 text-sm text-green-600">
                    You've been invited by {invitation.organization_name}
                  </p>
                  <p className="mt-1 text-xs text-green-500">
                    Email: {invitation.email}
                  </p>
                </motion.div>

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

                  {/* Name fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name" required>
                        First Name
                      </Label>
                      <Input
                        id="first_name"
                        placeholder="John"
                        error={errors.first_name?.message}
                        className="h-11"
                        {...register('first_name')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="last_name" required>
                        Last Name
                      </Label>
                      <Input
                        id="last_name"
                        placeholder="Smith"
                        error={errors.last_name?.message}
                        className="h-11"
                        {...register('last_name')}
                      />
                    </div>
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
                        placeholder="Create a strong password"
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
                    <p className="text-xs text-neutral-500">
                      At least 8 characters with uppercase, lowercase, and a number
                    </p>
                  </div>

                  {/* Confirm password field */}
                  <div className="space-y-2">
                    <Label htmlFor="password_confirm" required>
                      Confirm Password
                    </Label>
                    <Input
                      id="password_confirm"
                      type="password"
                      placeholder="Confirm your password"
                      error={errors.password_confirm?.message}
                      className="h-11"
                      {...register('password_confirm')}
                    />
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
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Already have account */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-neutral-600">
              Already have an account?{' '}
              <Link to="/portal/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in
              </Link>
            </p>
          </motion.div>

          {/* Version info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 text-center text-xs text-neutral-400"
          >
            Dillanci Supplier Portal v1.0.0
          </motion.p>
        </div>
      </div>
    </div>
  );
}

function InvalidInvitation({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="shadow-2xl border-primary-100/50 backdrop-blur-sm bg-white/95">
              <CardContent className="pt-8 pb-8">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="flex justify-center mb-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                  </motion.div>
                  <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
                  <p className="mt-2 text-sm text-neutral-600">{message}</p>
                  <Link
                    to="/portal/login"
                    className="inline-block mt-6 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Go to login →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Version info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-xs text-neutral-400"
          >
            Dillanci Supplier Portal v1.0.0
          </motion.p>
        </div>
      </div>
    </div>
  );
}

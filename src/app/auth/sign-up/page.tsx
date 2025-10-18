'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

export default function SignUpPage() {
  const router = useRouter()
  const { signUp } = useAuth()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    phone: ''
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailVerificationPending, setEmailVerificationPending] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [lastResendTime, setLastResendTime] = useState<number>(0)
  const [resendCooldown, setResendCooldown] = useState<number>(0)

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName) {
      return 'Please enter your full name'
    }
    if (!formData.email) {
      return 'Please enter your email address'
    }
    if (!formData.email.includes('@')) {
      return 'Please enter a valid email address'
    }
    if (!formData.password) {
      return 'Please enter a password'
    }
    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters'
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }
    if (!formData.restaurantName) {
      return 'Please enter your restaurant name'
    }
    return null
  }

  const handleResendEmail = async () => {
    // Check cooldown (60 seconds)
    const now = Date.now()
    const timeSinceLastResend = now - lastResendTime
    if (timeSinceLastResend < 60000) {
      const remainingSeconds = Math.ceil((60000 - timeSinceLastResend) / 1000)
      setError(`Please wait ${remainingSeconds} seconds before resending`)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: resendError } = await signUp(formData.email, formData.password, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        restaurant_name: formData.restaurantName,
        phone: formData.phone,
        role: 'manager'
      })

      if (resendError) {
        // Show user-friendly message for rate limit
        if (resendError.toLowerCase().includes('rate limit')) {
          setError('Too many attempts. Please wait an hour and try again, or contact support if urgent.')
        } else {
          setError(resendError)
        }
      } else {
        setLastResendTime(now)
        setResendCooldown(60)
        setError('') // Clear any previous errors
        // Show success message briefly
        alert('Verification email resent! Please check your inbox.')
      }
    } catch (error) {
      setError('Failed to resend email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      // Sign up the user with metadata
      const { error: signUpError } = await signUp(formData.email, formData.password, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        restaurant_name: formData.restaurantName,
        phone: formData.phone,
        role: 'manager'
      })

      if (signUpError) {
        // Show user-friendly message for rate limit
        if (signUpError.toLowerCase().includes('rate limit')) {
          setError('Too many sign-up attempts. Please wait an hour before trying again. If urgent, contact support.')
        } else {
          setError(signUpError)
        }
        return
      }

      // Show email verification message instead of redirecting
      // User needs to verify their email before they can continue
      setUserEmail(formData.email)
      setEmailVerificationPending(true)

    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // If email verification is pending, show verification message
  if (emailVerificationPending) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Check Your Email</CardTitle>
          <CardDescription className="text-center">
            We've sent a verification link to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <p className="text-gray-700">
                We sent a verification email to:
              </p>
              <p className="font-semibold text-gray-900">{userEmail}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-left">
              <p className="font-medium text-blue-900 mb-2">Next steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the verification link in the email</li>
                <li>You'll be redirected back to complete your setup</li>
              </ol>
            </div>

            {error && (
              <Alert className="alert-error">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 pt-4">
              <p className="text-sm text-gray-600">
                Didn't receive the email?
              </p>
              <Button
                onClick={handleResendEmail}
                disabled={loading || resendCooldown > 0}
                className="btn btn-outline w-full"
                type="button"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : resendCooldown > 0 ? (
                  `Wait ${resendCooldown}s to resend`
                ) : (
                  'Resend Verification Email'
                )}
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600 pt-4 border-t">
              Wrong email?{' '}
              <button
                onClick={() => setEmailVerificationPending(false)}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Go back and try again
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Create Your Account</CardTitle>
        <CardDescription className="text-center">
          Start managing your restaurant schedule today
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert className="alert-error">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                {error}
                {error.toLowerCase().includes('already registered') && (
                  <>
                    {' '}
                    <Link
                      href="/auth/login"
                      className="underline font-medium hover:text-red-800"
                    >
                      Sign in here
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Personal Information */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Personal Information</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className="input"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Smith"
                  className="input"
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@restaurant.com"
              className="input"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="868-555-0123"
              className="input"
            />
          </div>

          {/* Restaurant Information */}
          <div>
            <Label htmlFor="restaurantName">Restaurant Name</Label>
            <Input
              id="restaurantName"
              name="restaurantName"
              type="text"
              value={formData.restaurantName}
              onChange={handleChange}
              placeholder="Trini Flavors Restaurant"
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be your main restaurant name in the system
            </p>
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                placeholder="Choose a strong password"
                className="input pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className="input pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          {/* Login Link */}
          <div className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign in here
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
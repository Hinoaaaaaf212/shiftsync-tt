'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Clock, Users, Plus, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDateTrinidad, formatTimeTrinidad, formatCurrencyTTD } from '@/lib/date-utils'
import { useAuth } from '@/contexts/auth-context'
import { FadeIn } from '@/components/animations/fade-in'
import { SlideIn } from '@/components/animations/slide-in'

export default function HomePage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [demoDate] = useState(new Date())

  // Redirect authenticated users
  useEffect(() => {
    if (!loading && user) {
      // Check if user has completed setup
      if (employee || restaurant) {
        // User has completed setup - go to dashboard
        router.push('/dashboard')
      } else {
        // New user needs to complete setup
        router.push('/auth/setup-restaurant')
      }
    }
  }, [user, loading, employee, restaurant, router])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">ShiftSync TT</h1>
            </div>
            <div className="flex space-x-3">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-success-50 opacity-50"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Animated Calendar Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center animate-float shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Staggered Text Animations */}
          <h1 className="text-4xl font-bold text-gray-900 mb-6 animate-slide-up">
            The Smarter Way to Schedule
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto animate-slide-up animation-delay-200">
            Manage your business staff schedules with ease. Built specifically for Trinidad & Tobago
            businesses with local date formats and payment methods.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up animation-delay-400">
            <Button size="lg" className="text-base hover-lift" asChild>
              <Link href="/auth/sign-up">
                <Plus className="w-5 h-5 mr-2" />
                Start Free Trial
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-base hover-lift" asChild>
              <Link href="/auth/login">
                View Demo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trinidad-specific Features Alert */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-4xl mx-auto">
          <Alert className="alert-info">
            <AlertCircle className="w-5 h-5" />
            <AlertDescription>
              <strong>Built for Trinidad:</strong> DD/MM/YYYY date format,
              TTD currency, and mobile-optimized for Caribbean connectivity.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Demo Components */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              See It In Action
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Shift Card Demo */}
            <SlideIn direction="up" delay={100}>
              <Card className="card hover-lift">
                <CardHeader className="card-header">
                  <CardTitle className="card-title">Today's Schedule</CardTitle>
                  <CardDescription>
                    {formatDateTrinidad(demoDate)}
                  </CardDescription>
                </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Maria Johnson</h4>
                      <p className="text-sm text-gray-500">Server</p>
                    </div>
                    <Badge className="badge-server">Server</Badge>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Monday, {formatDateTrinidad(demoDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatTimeTrinidad('09:00')} - {formatTimeTrinidad('17:00')}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1">
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </SlideIn>

            {/* Employee List Demo */}
            <SlideIn direction="up" delay={200}>
              <Card className="card hover-lift">
                <CardHeader className="card-header">
                  <CardTitle className="card-title">Staff Overview</CardTitle>
                <CardDescription>
                  5 active employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">John Smith</p>
                        <p className="text-sm text-gray-500">{formatCurrencyTTD(25.00)}/hour</p>
                      </div>
                    </div>
                    <Badge className="badge-cook">Cook</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Sarah Wilson</p>
                        <p className="text-sm text-gray-500">{formatCurrencyTTD(22.50)}/hour</p>
                      </div>
                    </div>
                    <Badge className="badge-bartender">Bartender</Badge>
                  </div>

                  <div className="pt-3">
                    <Button size="sm" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Employee
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </SlideIn>

            {/* Alerts Demo */}
            <SlideIn direction="up" delay={300}>
              <Card className="card hover-lift">
                <CardHeader className="card-header">
                  <CardTitle className="card-title">Notifications</CardTitle>
                <CardDescription>
                  Stay informed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert className="alert-success">
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                      <strong>Schedule published!</strong> Your team can now view their shifts.
                    </AlertDescription>
                  </Alert>

                  <Alert className="alert-warning">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                      <strong>Reminder:</strong> Block off any holidays or closure days in Settings.
                    </AlertDescription>
                  </Alert>

                  <div className="pt-2">
                    <Button size="sm" variant="outline" className="w-full">
                      View All Alerts
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Perfect for Trinidad & Tobago Businesses
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <SlideIn direction="up" delay={100}>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Scheduling</h3>
                <p className="text-gray-600">
                  Block off holidays and closure days. Manage shifts with drag-and-drop ease.
                </p>
              </div>
            </SlideIn>

            <SlideIn direction="up" delay={200}>
              <div className="text-center">
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-success-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Trinidad Format</h3>
                <p className="text-gray-600">
                  DD/MM/YYYY dates and 12-hour time format. Currency in TTD.
                  Built the way you work.
                </p>
              </div>
            </SlideIn>

            <SlideIn direction="up" delay={300}>
              <div className="text-center">
                <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-warning-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Mobile First</h3>
                <p className="text-gray-600">
                  Optimized for Caribbean mobile networks. Fast loading,
                  works offline, installs on home screen.
                </p>
              </div>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-semibold">ShiftSync TT</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Smart scheduling for Trinidad & Tobago businesses. Built by locals, for locals.
            </p>
            <p className="text-sm text-gray-500">
              © 2024 ShiftSync TT. Made in Trinidad & Tobago.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
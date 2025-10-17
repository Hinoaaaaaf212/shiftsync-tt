import { Calendar } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800"></div>
        <div className="relative z-10 text-center text-white px-8">
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">ShiftSync TT</h1>
          <p className="text-xl text-blue-100 mb-8">
            Smart scheduling for businesses in Trinidad and Tobago
          </p>
          <div className="space-y-4 text-blue-100">
            <div className="flex items-center justify-center space-x-3">
              <Calendar className="w-5 h-5" />
              <span>DD/MM/YYYY date format</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <Calendar className="w-5 h-5" />
              <span>TTD currency support</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <Calendar className="w-5 h-5" />
              <span>Mobile-optimized for TT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ShiftSync TT</h1>
            </div>
            <p className="text-gray-600">Smart scheduling for businesses in Trinidad and Tobago</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
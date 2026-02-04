import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <aside className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 p-12 flex-col justify-between" aria-label="Product information">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/laflo-logo.png"
              alt="LaFlo - Hotel Management System"
              className="h-10 w-10 rounded-xl bg-white/20 p-1.5 object-contain"
            />
            <span className="text-2xl font-bold text-white">LaFlo</span>
          </div>
          <h1 className="mt-12 text-4xl font-bold text-white leading-tight">
            Modern Hotel Management,
            <br />
            <span className="text-primary-200">Simplified.</span>
          </h1>
          <p className="mt-4 text-lg text-primary-100 max-w-md">
            Streamline your operations, delight your guests, and grow your business with our
            comprehensive hotel management platform.
          </p>
        </div>

        <div className="space-y-6" role="list">
          <div className="flex items-start gap-4" role="listitem">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10" aria-hidden="true">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">Real-time Updates</h2>
              <p className="text-sm text-primary-200">
                Live room status and booking updates across all devices
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4" role="listitem">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10" aria-hidden="true">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">Mobile Ready</h2>
              <p className="text-sm text-primary-200">
                Works seamlessly on tablets and phones for all staff roles
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4" role="listitem">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10" aria-hidden="true">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">Powerful Analytics</h2>
              <p className="text-sm text-primary-200">
                Track revenue, occupancy, and performance in real-time
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-primary-300">
          &copy; {new Date().getFullYear()} LaFlo. All rights reserved.
        </p>
      </aside>

      {/* Right side - Auth forms */}
      <section className="flex w-full lg:w-1/2 items-center justify-center p-8" aria-label="Authentication">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

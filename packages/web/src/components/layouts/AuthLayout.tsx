import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left side - Branding */}
      <aside
        className="relative hidden min-h-screen overflow-hidden lg:block lg:w-[55%]"
        aria-label="Product information"
      >
        <div
          className="absolute inset-0 bg-cover bg-left"
          style={{
            backgroundImage: "url('/assets/auth/laflo-login-reference.png')",
            backgroundSize: '200% 100%',
            backgroundPosition: 'left center',
          }}
          aria-hidden="true"
        />
        <div className="sr-only">
          LaFlo. Modern Hotel Management, Simplified.
        </div>
      </aside>

      {/* Right side - Auth forms */}
      <section className="flex w-full items-center justify-center bg-white px-7 py-10 lg:w-[45%] lg:items-start lg:px-14 lg:pt-[135px] xl:px-20" aria-label="Authentication">
        <div className="w-full max-w-[600px]">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

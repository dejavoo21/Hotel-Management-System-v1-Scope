/**
 * Skip Link Component
 * Allows keyboard users to skip navigation and jump directly to main content
 * WCAG 2.1 Level A requirement
 */

export default function SkipLink() {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const mainContent = document.getElementById('main-content');
    mainContent?.focus();
    mainContent?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="absolute top-0 left-0 bg-primary-600 text-white px-4 py-2 -translate-y-full focus:translate-y-0 z-50 transition-transform duration-200"
    >
      Skip to main content
    </a>
  );
}

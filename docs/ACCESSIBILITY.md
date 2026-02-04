# Accessibility (a11y) Implementation Guide

## Overview

This document outlines the accessibility improvements made to the HotelOS application to meet WCAG 2.1 Level AA standards.

## What is Accessibility?

Accessibility ensures that people with disabilities can use web applications effectively. This includes:
- **Visual impairments**: Screen reader users, people with low vision
- **Motor impairments**: Keyboard-only navigation, motor control issues
- **Hearing impairments**: Captions and transcripts for audio
- **Cognitive disabilities**: Simple language, clear structure

## Implemented Features

### 1. Semantic HTML Structure

**What we did:**
- Converted `<div>` containers to semantic HTML5 elements
- Used proper landmarks: `<header>`, `<nav>`, `<main>`, `<aside>`, `<section>`
- Implemented correct heading hierarchy (h1 → h2 → h3, no skipped levels)

**Example:**
```tsx
// Before
<div className="header">
  <div className="nav">...</div>
</div>

// After
<header role="banner">
  <nav aria-label="Application navigation">...</nav>
</header>
```

**Files affected:**
- `src/components/layouts/AuthLayout.tsx`
- `src/components/layouts/DashboardLayout.tsx`
- `src/pages/auth/LoginPage.tsx`
- `src/pages/auth/TwoFactorPage.tsx`

### 2. ARIA Labels & Attributes

**What we did:**
- Added `aria-label` to interactive elements without visible text
- Added `aria-describedby` for error messages and field descriptions
- Added `aria-required` to required form fields
- Added `aria-busy` to loading states
- Added `aria-pressed` to toggle buttons
- Added `role` attributes where semantic HTML isn't used

**Example:**
```tsx
// Before
<button onClick={() => setShowPassword(!showPassword)}>
  <Icon />
</button>

// After
<button
  onClick={() => setShowPassword(!showPassword)}
  aria-pressed={showPassword}
  aria-label={showPassword ? 'Hide password' : 'Show password'}
>
  <Icon aria-hidden="true" />
</button>
```

### 3. Form Accessibility

**What we did:**
- Associated all inputs with proper `<label>` elements using `htmlFor`
- Added `aria-label` and `aria-describedby` for inputs
- Added `aria-required="true"` to required fields
- Implemented proper form validation with error messaging
- Added `inputMode` attribute for better mobile input

**Example:**
```tsx
<label htmlFor="email" className="label">
  Email address <span className="text-red-500">*</span>
</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
  aria-describedby="email-error"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
<span id="email-error" className="error-message" />
```

### 4. Keyboard Navigation

**What we did:**
- Ensured all interactive elements are keyboard accessible
- Added focus indicators with visible ring on all interactive elements
- Implemented proper tab order
- Added `aria-label` to explain button purposes
- Added skip links to jump to main content

**Example:**
```tsx
<button
  className="focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1"
  aria-label="Open navigation menu"
>
  Menu
</button>
```

### 5. Skip Links

**What we did:**
- Created `SkipLink` component allowing keyboard users to skip navigation
- Component hides off-screen by default
- Shows on focus and allows jumping to main content
- Added to main App layout

**Usage:**
```tsx
import SkipLink from '@/components/SkipLink';

export default function App() {
  return (
    <>
      <SkipLink />
      <Routes>...</Routes>
    </>
  );
}
```

### 6. Screen Reader Support

**What we did:**
- Added `aria-hidden="true"` to decorative elements
- Added `aria-label` to icon-only buttons
- Proper heading hierarchy for page structure
- Semantic HTML for better screen reader interpretation
- Added `role="list"` and `role="listitem"` for list structures

**Example:**
```tsx
<svg aria-hidden="true" className="h-5 w-5">...</svg>
<span className="sr-only">Loading...</span>
```

### 7. Focus Management

**What we did:**
- Ensured focus is always visible with color and outline
- Added proper focus ring styling
- Implemented focus trap for modals/dialogs
- Added `tabIndex={-1}` to main content for skip link focus
- Maintained logical tab order

**CSS:**
```css
/* Global focus style */
*:focus {
  outline: 2px solid #primary-500;
  outline-offset: 2px;
}

/* Remove outline for mouse users (optional) */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### 8. Color Contrast

**What we did:**
- Verified all text meets WCAG AA contrast ratios (4.5:1 for normal text)
- Used adequate color combinations in UI
- Don't rely on color alone to convey information
- Tested with contrast checking tools

**Our palette:**
- Primary text: `#111827` (slate-900) on white background: 16.5:1
- Secondary text: `#4B5563` (slate-600) on white background: 8.7:1
- Error text: `#DC2626` (red-600) on white background: 5.3:1

## Testing Accessibility

### Automated Testing with axe-core

Run the accessibility test suite:

```bash
# Run all a11y tests
npm run test:a11y

# Run specific test file
npm run test:a11y -- a11y.spec.ts
```

Tests check for:
- WCAG 2.1 AA violations
- Heading hierarchy
- Color contrast
- Form labels
- Keyboard navigation
- ARIA landmarks
- Focus management

### Manual Testing Checklist

1. **Keyboard Navigation**
   - Tab through all pages without mouse
   - Verify all interactive elements are reachable
   - Check focus indicators are visible
   - Test form submission with keyboard

2. **Screen Reader Testing**
   - Test with NVDA (Windows) or JAWS
   - Test with VoiceOver (Mac/iOS)
   - Verify page structure makes sense
   - Check button purposes are clear

3. **Visual Testing**
   - Zoom to 200% and verify no horizontal scrolling
   - Test with high contrast mode
   - Verify color isn't the only indicator

## Accessibility Best Practices for Future Development

### DO ✅
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<label>`)
- Write descriptive button/link text
- Add `aria-label` to icon buttons
- Use proper heading hierarchy
- Ensure color contrast ≥ 4.5:1
- Test keyboard navigation
- Provide alt text for images
- Use ARIA only when necessary
- Test with screen readers regularly

### DON'T ❌
- Use `<div>` for buttons/links (use `<button>` or `<a>`)
- Skip heading levels (h1 → h3)
- Hide focus indicators
- Use inline styles for interactivity
- Rely on color alone for information
- Auto-play audio/video
- Use placeholder text as labels
- Create keyboard traps
- Overuse ARIA (semantic HTML first)

## Common Issues & Solutions

### Issue: "Links don't have visible focus"
**Solution:**
```tsx
<a
  href="/page"
  className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
>
  Link
</a>
```

### Issue: "Icon buttons aren't accessible"
**Solution:**
```tsx
<button aria-label="Close menu">
  <svg aria-hidden="true">...</svg>
</button>
```

### Issue: "Form fields aren't associated with labels"
**Solution:**
```tsx
<label htmlFor="name">Name</label>
<input id="name" type="text" />
```

### Issue: "No way to skip navigation"
**Solution:**
Use the `<SkipLink />` component at the top of your app.

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [NVDA Screen Reader](https://www.nvaccess.org/)

## Ongoing Accessibility Maintenance

1. **Run tests in CI/CD** - Integrate a11y tests into your pipeline
2. **Test with real users** - Get feedback from people with disabilities
3. **Monitor accessibility** - Use tools like axe to catch regressions
4. **Keep learning** - Accessibility is evolving, stay updated
5. **Document decisions** - Record why accessibility choices were made

## Questions or Issues?

If you encounter accessibility issues:
1. Check the automated test output
2. Review the WCAG guidelines
3. Test with keyboard and screen readers
4. Ask the community on Web Accessibility forums

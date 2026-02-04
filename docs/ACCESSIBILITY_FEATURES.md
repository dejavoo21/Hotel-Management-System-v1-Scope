# ♿ Accessibility Features & Compliance

## Overview

HotelOS is committed to being accessible to everyone, including people with disabilities. We've implemented comprehensive accessibility features to meet **WCAG 2.1 Level AA** standards.

## Quick Links

- 📖 [Full Accessibility Guide](./docs/ACCESSIBILITY.md)
- 🚀 [Implementation Details](./ACCESSIBILITY_IMPLEMENTATION.md)
- ⚡ [Quick Reference](./A11Y_QUICK_REFERENCE.md)
- 🧪 [Test Suite](./packages/web/src/__tests__/a11y.spec.ts)

## Key Features

### ✅ Keyboard Navigation
- Skip link to jump to main content
- All interactive elements are keyboard accessible
- Logical tab order throughout the application
- Clear focus indicators on all elements

### ✅ Screen Reader Support
- Semantic HTML structure with proper landmarks
- ARIA labels and descriptions
- Proper heading hierarchy
- Alternative text for images
- Live regions for dynamic content

### ✅ Visual Accessibility
- 4.5:1 color contrast for all text
- Focus indicators visible on all elements
- Proper heading hierarchy
- No color as the only information indicator

### ✅ Form Accessibility
- All form fields have associated labels
- Error messages linked to inputs
- Required fields clearly marked
- Proper input types for mobile keyboards

### ✅ Testing & Documentation
- Automated accessibility test suite (axe-core)
- Comprehensive guides for developers
- Pre-commit accessibility checks
- Quick reference cards

## Running Accessibility Tests

### Automated Tests
```bash
# Run all accessibility tests
npm run test:a11y

# Run specific test file
npm run test:a11y -- a11y.spec.ts

# Run with specific browser
npm run test:a11y -- --project=chromium
```

### Pre-Commit Checks
```bash
# Check code for common accessibility issues
npm run check:a11y
```

### Manual Testing
1. **Keyboard Only**: Navigate using Tab, Shift+Tab, Enter, Escape
2. **Screen Readers**: Test with NVDA (Windows) or VoiceOver (Mac)
3. **Zoom**: Test at 200% zoom level
4. **High Contrast**: Enable high contrast mode in OS

## Accessibility Standards

### WCAG 2.1 Level AA ✅
Our implementation meets all Level AA requirements:
- **Perceivable**: Content is perceivable to users with various impairments
- **Operable**: All functionality is keyboard accessible
- **Understandable**: Clear structure and language
- **Robust**: Compatible with assistive technologies

### Section 508 Compliance
The application is built to comply with US Section 508 standards for government accessibility.

### ARIA Support
- Proper use of ARIA landmarks and attributes
- Only ARIA when semantic HTML isn't available
- Correct ARIA labeling strategies

## Testing Checklist for Developers

Before committing code, verify:

- [ ] All form inputs have `<label>` elements
- [ ] Buttons have descriptive text or `aria-label`
- [ ] Interactive elements have focus indicators
- [ ] Images have alt text
- [ ] No skipped heading levels
- [ ] Semantic HTML used (button, link, nav, main, etc)
- [ ] Color contrast ≥ 4.5:1
- [ ] Tab order is logical
- [ ] No keyboard traps
- [ ] Screen reader tested

## Common Accessibility Patterns

### Icon Button
```tsx
<button aria-label="Close menu">
  <svg aria-hidden="true">...</svg>
</button>
```

### Form Field
```tsx
<label htmlFor="email">Email Address</label>
<input 
  id="email"
  type="email"
  required
  aria-required="true"
/>
```

### Navigation Landmark
```tsx
<nav aria-label="Main navigation">
  {/* Navigation links */}
</nav>
```

### Skip Link
```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {/* Page content */}
</main>
```

## Tools & Resources

### Testing Tools
- **axe DevTools** - Automated accessibility checks
- **WAVE** - Web accessibility evaluation tool
- **Lighthouse** - Chrome built-in accessibility audit
- **NVDA** - Free screen reader (Windows)

### Learning Resources
- [W3C WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Color Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Contrast Ratio](https://contrast-ratio.com/)
- [Color Oracle](https://www.colororacle.org/) - Color blindness simulator

## Known Limitations & Roadmap

### Current Implementation
- ✅ Authentication pages (login, 2FA)
- ✅ Dashboard layout and navigation
- ✅ Basic semantic structure
- ✅ Form accessibility
- ✅ Keyboard navigation

### Future Improvements
- 🔄 Data tables with proper headers
- 🔄 Complex modals with focus management
- 🔄 Dropdown menus with keyboard control
- 🔄 Autocomplete components
- 🔄 Dark mode with contrast support

## Reporting Accessibility Issues

Found an accessibility issue? Please report it by:

1. **Opening an Issue** with:
   - Description of the problem
   - Steps to reproduce
   - Expected behavior
   - Screen reader/assistive technology used

2. **Describing the impact**:
   - How does it affect users?
   - What WCAG criterion is violated?

3. **Providing context**:
   - Page or component affected
   - Browser/OS used
   - Screenshot or screen recording

## Accessibility Team

- **Accessibility Champion**: [Your Name]
- **Point of Contact**: [Email]
- **Last Audited**: February 3, 2026

## References

- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- Section 508: https://www.section508.gov/
- EN 301 549: https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf

---

**Note**: Accessibility is an ongoing process. We regularly audit and improve our application. For questions about our accessibility practices, please contact us.

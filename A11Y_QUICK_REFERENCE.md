# Accessibility Quick Reference Card

## Form Labels & Inputs

### ✅ DO THIS
```tsx
<label htmlFor="email">Email Address</label>
<input 
  id="email"
  type="email"
  aria-required="true"
  aria-describedby="email-error"
  required
/>
<span id="email-error" role="alert">Error message here</span>
```

### ❌ DON'T DO THIS
```tsx
<input type="email" placeholder="Email" />
<div>Error message</div>
```

---

## Buttons & Links

### ✅ DO THIS
```tsx
<button aria-label="Close menu">
  <svg aria-hidden="true">...</svg>
</button>

<a href="/page" className="focus:ring-2">Link text</a>
```

### ❌ DON'T DO THIS
```tsx
<div onClick={handleClick}>Click me</div>
<a href="#" onClick={handler}>Link</a>
```

---

## Focus Management

### ✅ DO THIS
```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-primary-500 rounded">
  Button
</button>

<input className="focus:ring-2 focus:ring-primary-500" />
```

### ❌ DON'T DO THIS
```tsx
<button style={{ outline: 'none' }}>Button</button>
<button style={{ border: 'none' }}>Button</button>
```

---

## Semantic HTML

### ✅ DO THIS
```tsx
<header>Navigation here</header>
<nav>Links here</nav>
<main>Content here</main>
<footer>Copyright here</footer>

<section aria-label="User info">...</section>
<aside aria-label="Related">...</aside>
```

### ❌ DON'T DO THIS
```tsx
<div className="header">Navigation</div>
<div className="nav">Links</div>
<div className="main">Content</div>
<div className="footer">Copyright</div>
```

---

## Headings

### ✅ DO THIS
```tsx
<h1>Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>
```

### ❌ DON'T DO THIS
```tsx
<h1>Page Title</h1>
<h3>Section Title</h3>  {/* Skip h2! */}
<h2>Another Section</h2>
```

---

## Skip Links

### ✅ DO THIS
```tsx
<a 
  href="#main-content" 
  className="-translate-y-full focus:translate-y-0"
>
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  Page content
</main>
```

---

## Images & Icons

### ✅ DO THIS
```tsx
<img src="user.jpg" alt="John Doe, project manager" />
<img src="decoration.png" alt="" aria-hidden="true" />

<button aria-label="Close">
  <svg aria-hidden="true">...</svg>
</button>
```

### ❌ DON'T DO THIS
```tsx
<img src="user.jpg" />
<img src="decoration.png" alt="decoration" />
<button><svg>Icon</svg></button>
```

---

## Loading States

### ✅ DO THIS
```tsx
<button aria-busy={isLoading} disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</button>

<div role="status" aria-live="polite">
  Loading content...
</div>
```

### ❌ DON'T DO THIS
```tsx
{isLoading && <Spinner />}
```

---

## Lists

### ✅ DO THIS
```tsx
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>

{/* Custom lists */}
<div role="list">
  <div role="listitem">Item 1</div>
  <div role="listitem">Item 2</div>
</div>
```

### ❌ DON'T DO THIS
```tsx
<div>
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## ARIA Labels

### ✅ DO THIS
```tsx
{/* Icon button */}
<button aria-label="Search">
  <svg aria-hidden="true">...</svg>
</button>

{/* Landmark */}
<nav aria-label="Main navigation">...</nav>

{/* Description */}
<input aria-describedby="hint" />
<span id="hint">Hint text</span>
```

### ❌ DON'T DO THIS
```tsx
<button title="Search">
  <svg>Search</svg>
</button>

<nav>Menu</nav>
```

---

## Color Contrast

### ✅ DO
- Text: 4.5:1 (AA) or 7:1 (AAA)
- Large text (18+ or 14+ bold): 3:1 (AA)
- UI components: 3:1 (AA)

### ❌ DON'T
- Rely on color alone
- Use #999999 text on white (3.5:1)
- Use low contrast decorative elements

---

## Keyboard Navigation

### ✅ DO THIS
```tsx
export default function Component() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Close
    }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <button onClick={onClick}>Button</button>
      <input type="text" />
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Tab through page - all interactive elements reachable
- [ ] Shift+Tab backwards - correct reverse order
- [ ] Enter on buttons - triggers action
- [ ] Space on toggle buttons - toggles state
- [ ] Arrow keys on dropdowns - navigate options
- [ ] Escape on modals - closes dialog
- [ ] Focus indicators visible - ring or outline shows
- [ ] Screen reader announces - content read correctly
- [ ] Color contrast ≥ 4.5:1 - readable text
- [ ] Zoom to 200% - no horizontal scroll

---

## Tools

- **Testing**: axe DevTools, WAVE, Lighthouse
- **Screen Readers**: NVDA (Win), JAWS (Win), VoiceOver (Mac)
- **Contrast Checker**: WebAIM, Contrast Ratio
- **Color Blind Simulator**: Coblis, Color Oracle

---

## Standards

- WCAG 2.1 Level AA (target)
- Section 508 (US Government)
- EN 301 549 (European Accessibility Act)

---

## Remember

> **Accessibility is not a feature, it's a responsibility.**

The more accessible your code, the more users can benefit from your application.

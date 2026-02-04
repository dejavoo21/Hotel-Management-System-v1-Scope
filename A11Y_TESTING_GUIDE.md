# 🔧 Accessibility Testing & Verification Guide

## Quick Start

### 1. Run Automated Tests
```bash
npm run test:a11y
```

### 2. Check Code Before Commit
```bash
npm run check:a11y
```

### 3. Manual Keyboard Testing
- Start the app: `npm run dev`
- Use only keyboard: Tab, Shift+Tab, Enter, Arrow keys, Escape
- Try: Tab through login, fill form with Tab, submit with Enter

### 4. Screen Reader Testing
- **Windows**: Download [NVDA](https://www.nvaccess.org/) (free)
- **Mac**: Use built-in VoiceOver (Cmd+F5)
- Test: Login page, form fields, navigation

---

## Detailed Testing Procedures

### A. Keyboard Navigation Testing

#### Login Page
```
1. Tab to "Email address" field
   ✓ Verify focus is visible (ring around input)
   ✓ Verify label is associated

2. Tab to "Password" field
   ✓ Verify focus is visible
   ✓ Tab to "Show password" button
   ✓ Verify focus indicator on button

3. Tab through "Remember me" checkbox
   ✓ Press Space to toggle

4. Tab to "Forgot password" link
   ✓ Press Enter to navigate

5. Tab to "Use email code" button
   ✓ Press Enter to toggle mode
   ✓ Verify form updates

6. Tab to "Sign in" button
   ✓ Press Enter to submit form
   ✓ Verify loading state announced

7. Shift+Tab to go backwards through all elements
   ✓ Verify reverse order is logical
```

#### Dashboard
```
1. ✓ Verify skip link appears on focus
2. ✓ Tab through sidebar navigation
3. ✓ Tab through top bar (menu, search, notifications)
4. ✓ Tab through main content
5. ✓ Verify all buttons have focus indicators
6. ✓ No keyboard traps (can always move forward/backward)
```

### B. Screen Reader Testing (NVDA)

#### Setup
```
1. Download NVDA from https://www.nvaccess.org/
2. Install and run NVDA
3. Enable keyboard navigation (NVDA + Space → Browse mode)
4. Navigate application with Tab and arrow keys
```

#### Test Login Page
```
1. Page title should be announced: "HotelOS Login"
2. Main heading should be announced: "Welcome back (heading 1)"
3. Form label for email should be announced with "required"
4. Error messages should be linked to inputs
5. Button purposes should be clear: "Sign in button"
6. Demo credentials should be in a region: "Demo credentials section"
7. Navigation should announce "Login form"
```

#### Expected Announcements
```
Page load:
"HotelOS, document"

First Tab:
"Welcome back, heading 1"

Tab to email field:
"Email address, edit text, required"

Tab to password show button:
"Show password, button"

Tab to submit:
"Sign in, button, not pressed"

After form submission:
"Loading" → "Welcome back!" → "Navigating to dashboard"
```

### C. Visual Testing

#### High Contrast Mode
```
Windows:
1. Settings → Ease of Access → High Contrast
2. Select "High Contrast Black"
3. Reload page
4. Verify: 
   - All text is readable
   - Buttons are visible
   - Focus indicators are clear

macOS:
1. System Preferences → Accessibility → Display
2. Enable "Increase Contrast"
3. Reload page
4. Verify same items as above
```

#### Zoom Testing
```
1. Zoom to 200% (Ctrl + Plus)
2. Verify:
   - No horizontal scrolling required
   - Text is still readable
   - Buttons are still clickable
   - Layout adapts properly

3. Zoom to 300%
4. Verify same items

5. Zoom back to 100% (Ctrl + 0)
```

#### Color Blindness Simulation
```
Use Color Oracle: https://www.colororacle.org/

Test with:
- Deuteranopia (red-green)
- Protanopia (red-green)
- Tritanopia (blue-yellow)

Verify:
- Information not conveyed by color alone
- Text still readable
- Buttons still identifiable
```

### D. Focus Indicator Testing

```
Should see for every element:
- Blue ring around element: focus:ring-2 focus:ring-primary-500
- No flickering or disappearing focus
- Focus visible in both normal and high contrast modes

Test:
1. Click on various elements
2. Tab through page
3. Use Shift+Tab to go backward
4. Verify focus is always visible and logical
```

### E. Form Testing

#### Email Field
```
✓ Label visible and associated with input
✓ Required indicator shown (*)
✓ Input type="email" (mobile keyboard shows @)
✓ Error message appears below/beside field
✓ Error linked to input with aria-describedby
```

#### Password Field
```
✓ Label visible and associated with input
✓ Show/Hide button is accessible
✓ Button has aria-label describing its purpose
✓ Button has aria-pressed state
✓ Toggling doesn't lose focus
✓ Password not visible in placeholder
```

#### Two-Factor Code
```
✓ Fieldset with legend structure
✓ Each digit input has aria-label: "Digit 1 of 6"
✓ Auto-focus first digit
✓ Tab to next digit
✓ Shift+Tab to previous digit
✓ Paste functionality works
✓ Auto-submit when all digits entered
```

### F. Heading Hierarchy Testing

```
Test with NVDA:
1. Press H to navigate by headings
2. Should see proper structure:
   - h1: "Welcome back" (only one per page)
   - h2: "Demo credentials" (sub-sections)
   - h3: (if any subsections below h2)

3. No skipped levels (h1 → h3 is wrong)
4. Each page has exactly one h1
```

### G. Landmark Testing

```
NVDA Landmarks (Press R to navigate):
- region (aria-label="Main navigation")
- navigation (nav)
- main (main content)
- contentinfo (footer)

Expected on Dashboard:
✓ Navigation: "Main navigation"
✓ Navigation: "Application navigation"
✓ Main: (contains page content)
✓ Search in top bar
```

---

## Common Issues & How to Fix Them

### Issue: Focus Not Visible

**Problem**: Clicked element has no visible focus indicator

**Check**:
```tsx
// Should have this:
className="focus:outline-none focus:ring-2 focus:ring-primary-500"

// Or in CSS:
button:focus {
  outline: 2px solid #primary-500;
}

// Don't do this (removes focus):
className="focus:outline-none"
```

**Fix**: Add focus ring styling

---

### Issue: Form Field Not Associated with Label

**Problem**: Screen reader says "textbox" without saying what field it is

**Check**:
```tsx
// Wrong:
<label>Email</label>
<input type="email" />

// Right:
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

**Fix**: Add `htmlFor` to label and `id` to input

---

### Issue: Icon Button Not Labeled

**Problem**: Screen reader says "button" without describing what it does

**Check**:
```tsx
// Wrong:
<button onClick={closeMenu}>
  <svg>X</svg>
</button>

// Right:
<button onClick={closeMenu} aria-label="Close menu">
  <svg aria-hidden="true">X</svg>
</button>
```

**Fix**: Add `aria-label` to button, `aria-hidden` to icon

---

### Issue: Keyboard Trap

**Problem**: User can Tab forward but can't Tab backward to escape

**Check**:
```tsx
// Ensure no element has:
tabIndex="999" // High numbers can cause traps

// Ensure focus can escape with:
- Escape key
- Shift+Tab
- Esc to close modals
```

**Fix**: Verify tab order is logical and users can move forward/backward

---

### Issue: Low Color Contrast

**Problem**: Text hard to read, contrast ratio < 4.5:1

**Check**:
Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

**Fix**:
```css
/* Good contrast */
color: #111827;        /* Slate-900 on white: 16.5:1 */
color: #4B5563;        /* Slate-600 on white: 8.7:1 */

/* Bad contrast */
color: #999999;        /* Gray on white: 3.5:1 - FAIL */
```

---

## Test Report Template

```markdown
# Accessibility Test Report

**Date**: [Date]
**Tester**: [Name]
**Browser**: [Chrome/Firefox/Safari/Edge]
**Screen Reader**: [NVDA/JAWS/VoiceOver/Other]

## Test Results

### Keyboard Navigation
- [ ] All elements reachable with Tab
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] No keyboard traps

### Screen Reader
- [ ] Page title announced
- [ ] Headings announced correctly
- [ ] Form labels associated
- [ ] Button purposes clear
- [ ] Landmarks identified

### Visual
- [ ] Text readable at 200% zoom
- [ ] High contrast mode works
- [ ] Color blind mode readable
- [ ] Focus indicators visible

### Forms
- [ ] Labels associated
- [ ] Error messages linked
- [ ] Required fields marked
- [ ] Validation messages clear

## Issues Found

| Issue | Severity | Component | Fix |
|-------|----------|-----------|-----|
| ... | ... | ... | ... |

## Summary

Total Issues: X
- Critical: X
- High: X
- Medium: X
- Low: X

Status: [ ] Pass [ ] Fail - Needs Fixes
```

---

## Running Full Audit

```bash
# 1. Run automated tests
npm run test:a11y

# 2. Run code checks
npm run check:a11y

# 3. Start application
npm run dev

# 4. Manual testing:
#    - Test keyboard navigation
#    - Test with screen reader
#    - Test zoom at 200%
#    - Test high contrast mode
#    - Test on mobile (Touch + keyboard)

# 5. Check color contrast
#    - Use axe DevTools extension
#    - Use WebAIM Contrast Checker

# 6. Document findings
#    - Create test report
#    - File issues for failures
#    - Document workarounds

# 7. Fix and re-test
#    - Address critical issues first
#    - Re-run automated tests
#    - Verify fixes with manual testing
```

---

## Success Criteria

✅ **Keyboard Navigation**
- Can reach all interactive elements with Tab
- Tab order makes sense
- Can't get trapped anywhere
- All elements have visible focus

✅ **Screen Reader**
- Page structure is clear
- All buttons/links have purposes
- Form fields are labeled
- Error messages are associated
- Status changes announced

✅ **Visual**
- Text readable at zoom levels
- Color contrast ≥ 4.5:1
- Focus indicators always visible
- Works in high contrast mode

✅ **Forms**
- All fields have labels
- Required fields marked
- Errors are actionable
- Can submit with keyboard

✅ **Overall**
- WCAG 2.1 AA pass
- No automated violations
- Positive manual test results
- Ready for users with disabilities

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [NVDA Shortcuts](https://www.nvaccess.org/user-guide/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

**Last Updated**: February 3, 2026

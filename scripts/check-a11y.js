#!/usr/bin/env node

/**
 * Pre-commit Accessibility Checklist
 * 
 * Run this before committing code to catch accessibility issues early.
 * Usage: npm run check:a11y
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let errors = 0;
let warnings = 0;

console.log(`\n${BOLD}🔍 Accessibility Pre-Commit Checklist${RESET}\n`);

/**
 * Check for common accessibility issues
 */
const checks = {
  'No divs as buttons': {
    pattern: /onClick\s*=\s*[{"].*?[}"].*?<div/gm,
    fix: 'Use <button> instead of <div> for clickable elements',
    severity: 'error',
  },
  'No missing labels': {
    pattern: /<input[^>]*?id=['\"]([^'\"]+)['\"][^>]*\/?>(?!.*?<label[^>]*?for=['\"]([^'\"]+)['\"])/gm,
    fix: 'Ensure all inputs have associated <label> elements',
    severity: 'error',
  },
  'No missing alt text': {
    pattern: /<img[^>]*?(?!alt=)[^>]*?\/?>/gm,
    fix: 'Add alt text to all images (or use alt="" for decorative images)',
    severity: 'error',
  },
  'No skipped heading levels': {
    pattern: /<h1.*?<h3|<h2.*?<h4|<h3.*?<h5/gs,
    fix: 'Do not skip heading levels (h1 → h2 → h3)',
    severity: 'warning',
  },
  'Icon buttons need labels': {
    pattern: /<button[^>]*?(?!aria-label)[^>]*?>\\s*<svg/gm,
    fix: 'Add aria-label to icon buttons',
    severity: 'warning',
  },
  'Missing focus styles': {
    pattern: /className=\"[^\"]*?(?!.*focus:)[^\"]*\"/gm,
    fix: 'Add focus:ring-2 focus:ring-offset-2 to interactive elements',
    severity: 'warning',
  },
};

console.log(`${BOLD}Checking for common patterns...${RESET}\n`);

// Scan src directory
const srcDir = path.join(__dirname, '../src');
const files = getAllFiles(srcDir).filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  Object.entries(checks).forEach(([checkName, check]) => {
    if (check.pattern.test(content)) {
      const severity = check.severity === 'error' ? RED : YELLOW;
      console.log(`${severity}⚠  ${checkName}${RESET}`);
      console.log(`   File: ${path.relative(process.cwd(), file)}`);
      console.log(`   Fix: ${check.fix}\n`);
      
      if (check.severity === 'error') {
        errors++;
      } else {
        warnings++;
      }
    }
  });
});

/**
 * Manual checklist
 */
console.log(`${BOLD}Manual Checklist:${RESET}\n`);

const manualChecks = [
  '✓ All form fields have labels with htmlFor',
  '✓ All buttons have clear, descriptive text (or aria-label)',
  '✓ All images have alt text',
  '✓ Heading hierarchy is correct (no skipped levels)',
  '✓ Focus indicators are visible on all interactive elements',
  '✓ Semantic HTML used (button, link, nav, main, etc)',
  '✓ ARIA labels added where needed',
  '✓ Color contrast is adequate (4.5:1 for text)',
  '✓ No keyboard traps',
  '✓ Tab order is logical',
];

manualChecks.forEach(check => {
  console.log(`  ${check}`);
});

console.log('\\n');

/**
 * Summary
 */
if (errors === 0 && warnings === 0) {
  console.log(`${GREEN}${BOLD}✓ No accessibility issues found!${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}✗ Found ${errors} error(s) and ${warnings} warning(s)${RESET}\n`);
  if (errors > 0) {
    console.log(`${RED}Fix errors before committing.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${YELLOW}Warnings found. Please review.${RESET}\n`);
  }
}

/**
 * Helper function to get all files in directory
 */
function getAllFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules' && item !== '.') {
      files = files.concat(getAllFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  });
  
  return files;
}

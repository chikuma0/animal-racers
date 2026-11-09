# Gates: interrupted result input

- [x] R1: Interrupted pointer/visibility events recover without accepting carried releases; fresh gesture after the quiet pause works
  CHECK: npm test
  EXPECT: Test Files
  EVIDENCE: omarchy /bin/bash; CWD=/tmp/animal-racers-kids-20261020; exit=0; expectation matched; result-fix-tests.log sha256=4d1bd79eac47d660b4fd4cecc3eb49cbc72f1bed2684c3aaa25634233c636a4d
- [x] R2: Browser DOM interruption regression passes against production event binding
  CHECK: node scripts/qa/result-interruption.cjs
  EXPECT: RESULT_INTERRUPTION_PASS
  EVIDENCE: omarchy /bin/bash; CWD=/tmp/animal-racers-kids-20261020; exit=0; expectation matched; result-interruption-report.json sha256=425962129bb1ecc32d28fb3433857874c2949c2fb3b5008eafc91fcb7cba98b4
- [x] R3: Type, lint and production build succeed
  CHECK: npm run typecheck && npm run lint && npm run build
  EXPECT: Generating static pages
  EVIDENCE: omarchy /bin/bash; CWD=/tmp/animal-racers-kids-20261020; exit=0; expectation matched; result-fix-build.log sha256=57418af4da0ce9e5d47972d9f1405e17881c46812fa55f91ad5b61faf16911f5

Scope: fix input bookkeeping only; physical iPhone issue not reproduced. No deployment.

All 174 tests passed (including the new result-status regression). Typecheck and lint exit 0. DOM regression uses the actual production event binding and native Chromium touch, with one pointerup deliberately intercepted to model a missing notification. The old binding fails recovery; the new binding recovers after the quiet pause and requires a new gesture. Visibility-change recovery is also covered. WebKit could not launch on omarchy because required system libraries are absent; the user’s physical iPhone failure remains unconfirmed.

Additional acceptance: distinguish the four-second ceremony from held-input/quiet-pause states; keep a valid pressed button visually ready; suppress label selection/callout and double-tap zoom within the game while preserving invitation editing/copy and viewport settings.

Final CSS browser verification: labels cannot be selected by double-click; invitation input remains editable/selectable and copy button receives tap. Actual result JSX rendered at 844×390 and 390×844 has both action buttons and panel within viewport, with unchanged button positions between countdown and ready. CSS callout prevention is specified but physical Safari behavior remains unverified. Typecheck/lint exit 0 before final CSS-only spacing adjustment; final build and browser regression rerun after that adjustment, exit 0.

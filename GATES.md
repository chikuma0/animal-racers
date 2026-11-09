# Gates: Japanese child-friendly review build

Scope: Short Japanese flow, visible initial animal, fully framed racer, clear duel controls, protected cup ceremony; unchanged match rules and a private omarchy preview.

- [ ] G1: Camera framing and protected result activation pass regression tests together with existing simulation/network tests
  CHECK: npm test
  EXPECT: Test Files
  EVIDENCE: pending
- [ ] G2: Application type checks and lint have no errors
  CHECK: npm run typecheck && npm run lint
  EXPECT: eslint src/championship
  EVIDENCE: pending
- [ ] G3: Production build compiles the complete application
  CHECK: npm run build
  EXPECT: Generating static pages
  EVIDENCE: pending
- [ ] G4: Japanese short introduction and start button fit desktop and three phone viewports; duel and results respond correctly in browser
  EVIDENCE: pending
- [ ] G5: Initial character display timings are measured before and after on the same browser and machine
  EVIDENCE: pending
- [ ] G6: A private omarchy URL serves this source for independent parent review, without production changes
  EVIDENCE: pending

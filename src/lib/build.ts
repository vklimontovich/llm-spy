// Utility to check if we're in Next.js build phase
// During build, Next.js sets NEXT_PHASE to 'phase-production-build'
// We use this to skip operations that require runtime environment variables
export const isBuildPhase = () =>
  process.env.NEXT_PHASE === 'phase-production-build'

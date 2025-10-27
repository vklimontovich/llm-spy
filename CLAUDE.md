# Project Guidelines

## Package Manager

- **Always** use `bun` for all package management and script execution
- Do not use npm or yarn commands

## Development Server

- Dev server runs on port **3441** (not the default 3000)
- Start with: `bun dev`

## Build & Validation

- **Do not** run lint or compilation checks unless explicitly requested
- When building is needed, use: `bun run build`

## Database

- **Never** run `prisma` commands directly

## Code Style

- **Always** follow the code style defined in `.prettierrc`
- Key style preferences:
  - 2 spaces for indentation (no tabs)
  - Single quotes for strings
  - No semicolons
  - 80 character line width
  - Arrow functions without parens for single params
- When writing new code, match the existing code style

## Environment Variables

- See `src/lib/server-env.ts` for the complete list of environment variables
- Env variables should be never accessed via `process.env` directly, use `serverEnv` from @src/lib/server-env.ts instead

## useQuery

- Unless instructed, always rethrow errors from useQuery calls instead of handling them locally. We have an upper boundary
- Always set onError handler for useMutation calls. In the handler log error and show toast notification to the user via antd `notification.error`

## Git Operations

- **Always** use git commands for file operations:
  - After creating new files, run `git add <file>` to stage them
  - For moving files, use `git mv <source> <destination>` instead of regular `mv`
  - For removing files, use `git rm <file>` instead of regular `rm`

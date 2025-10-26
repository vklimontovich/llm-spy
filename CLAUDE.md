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
- Key required variables:
  - `DATABASE_URL` - PostgreSQL connection string
  - `GOOGLE_CLIENT_ID` - Google OAuth client ID
  - `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

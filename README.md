# LLM SPY

**Know How Your AI Agent Works**

LLM SPY records traffic between your AI Agent and LLMs, revealing exactly what it does - every prompt, tool call, and decision.

## Quick Example

Monitor Claude Code by simply changing one environment variable:

```bash
ANTHROPIC_BASE_URL="https://llms.klmn.sh" \
ANTHROPIC_CUSTOM_HEADERS="x-proxy-auth: YOUR-API-KEY" \
claude
```

That's it! Now you can see every prompt, response, and tool call in real-time.

**For more details and features, visit [https://llms.klmn.sh](https://llms.klmn.sh)**

## Getting Started

### Option 1: Hosted Service (Recommended)

The easiest way to get started is to sign up at [https://llms.klmn.sh](https://llms.klmn.sh). You'll get:

- Instant setup
- No infrastructure management
- Free during alpha

### Option 2: Self-Hosting

If you prefer to self-host, follow the instructions below for your preferred platform.

## Self-Hosting on Vercel (or other Next.js Platforms)

### Prerequisites

- A PostgreSQL database. You can use [Neon](https://neon.tech/) or [Supabase](https://supabase.com/), they have a generous free tier
- Google OAuth credentials (see below)
- [Bun](https://bun.sh/) installed locally

### 1. Fork/Clone this Repository

```bash
git clone https://github.com/vklimontovich/llm-spy.git
cd llm-spy
```

### 2. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3441/api/auth/callback/google` (for local testing)
   - `https://your-domain.com/api/auth/callback/google` (for production)
7. Save your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### 3. Initialize Database

Before deploying, initialize your database schema:

```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname" bun prisma db push
```

### 4. Environment Variables

See the [complete list with descriptions](src/lib/server-env.ts) in the source code.

| Variable               | Description                                                                                                  | Required        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | --------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                                                                 | Yes             |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID (see step 2)                                                                          | Yes             |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (see step 2)                                                                      | Yes             |
| `APP_ORIGIN`           | Your app URL (e.g., `http://localhost:3441` for local, `https://your-domain.com` for production)             | Yes             |
| `SIGNUP_ENABLED`       | Set to `true` for initial deploy to create your user account                                                 | Yes (initially) |
| `NEXTAUTH_SECRET`      | Random secret for NextAuth (e.g., `openssl rand -base64 32`) - optional, if not set will hash Google secrets | No              |
| `API_ORIGIN`           | Optional API origin if different from app URL                                                                | No              |

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set the environment variables from step 4
4. Deploy!

### 6. Create Your User Account

1. After the first deployment with `SIGNUP_ENABLED=true`, visit your app and sign in with Google
2. Your account will be created
3. **Important:** Redeploy with `SIGNUP_ENABLED=false` to prevent additional signups (unless you want multiple users)

## Self-Hosting with Docker

Docker deployment will follow this workflow:

### 1. Initialize Database

```bash
docker run -e DATABASE_URL="postgresql://..." \
  ghcr.io/vklimontovich/llm-spy:latest \
  db-sync
```

### 2. Run the Application

```bash
docker run -d \
  -p 3000:3000 \
  -e ...="..." \
  ghcr.io/vklimontovich/llm-spy:latest
```

See the [Environment Variables](#4-environment-variables) section above for the full list of supported variables.

## Development

### Local Setup

```bash
# Install dependencies
bun install

# Set up environment variables
cat > .env <<EOF
DATABASE_URL=postgresql://user:password@host:5432/dbname
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
APP_ORIGIN=http://localhost:3441
SIGNUP_ENABLED=true
EOF

# Initialize database
bun prisma db push

# Run development server
bun dev
```

### Build

```bash
bun run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For questions or issues, please [open an issue](https://github.com/YOUR_USERNAME/otel-proxy/issues) on GitHub.

export const DOMAIN = 'llms.klmn.sh'

export const copy = {
  // Brand
  brand: {
    name: 'LLM SPY',
    tagline: 'Know How Your AI Agent Works',
    description: 'Monitor and debug your AI agents with complete visibility',
  },

  // Hero Section
  hero: {
    badge: 'Alpha Release - Completely Free',
    title: 'Know How Your AI Agent Works',
    subtitle: 'LLM SPY records traffic between your AI Agent and LLMs, revealing exactly what it does - every prompt, tool call, and decision.',
    cta: {
      primary: 'Start Monitoring',
      secondary: 'See How It Works',
    },
  },

  // Sign In Page
  signin: {
    title: 'Get started',
    subtitle: 'Create an account or sign in to start monitoring your AI agents',
    backLink: 'Back to home',
    googleButton: 'Continue with Google',
    terms: {
      prefix: 'By signing up, you agree to our',
      termsLink: 'Terms of Service',
      and: 'and',
      privacyLink: 'Privacy Policy',
    },
    alphaBadge: 'Alpha Release - Completely Free',
    rightPanel: {
      title: 'See what your AI really does',
      subtitle: 'Complete visibility into every LLM interaction, tool call, and decision your AI agents make.',
      quickSetup: {
        title: 'Quick Setup',
        code: `export ANTHROPIC_BASE_URL=https://${DOMAIN}/workspace/anthropic`,
        description: "That's it! Your AI is now being monitored.",
      },
    },
  },

  // Features
  features: {
    visibility: {
      title: 'Complete Visibility',
      shortTitle: 'Complete Request Visibility',
      description: 'Know exactly what your LLM does - every prompt, response, tool call, and decision. No more black box AI.',
      shortDescription: 'Monitor every prompt, response, and tool call. See token usage, latency, and full execution flow.',
      points: ['Full prompt history', 'Tool execution logs', 'Token usage tracking'],
    },
    setup: {
      title: 'Instant Setup',
      shortTitle: 'One-Line Integration',
      description: 'Just change one environment variable and you\'re monitoring. No SDK integration, no code changes required.',
      shortDescription: 'Just change your base URL. Works with Claude, GPT-4, and any other LLM provider instantly.',
      points: ['One-line setup', 'Works with any agent', 'Zero performance impact'],
    },
    gateway: {
      title: 'LLM Translation Gateway',
      shortTitle: 'LLM Translation Gateway',
      description: 'Use any LLM through any interface. Your app talks to \'Anthropic\' but actually uses GPT-4.',
      shortDescription: 'Route any model through any interface. Use GPT-4 with Anthropic\'s format or vice versa.',
      points: ['Format conversion', 'Provider switching', 'Coming soon'],
    },
  },

  // How It Works
  howItWorks: {
    title: 'How It Works',
    subtitle: 'Set up in minutes, monitor everything instantly',
    steps: {
      create: {
        title: 'Create a Proxy',
        description: 'Point your AI agent to LLM SPY instead of the LLM provider directly. Just change one environment variable and you\'re monitoring.',
      },
      monitor: {
        title: 'Monitor Everything',
        description: 'View all LLM traffic in real-time. See prompts, responses, tool calls, token usage, and execution flow.',
      },
      share: {
        title: 'Share Conversations',
        description: 'Share specific LLM conversations with your team via secure, secret links. Perfect for debugging, collaboration, or demonstrating AI behavior.',
      },
    },
    example: {
      label: 'Example Use Case',
      title: 'Claude Code Monitoring',
      description: 'Monitor what Claude Code actually does by setting',
      variable: 'ANTHROPIC_BASE_URL',
      points: [
        'See all prompts and context',
        'Track tool usage patterns',
        'Monitor token consumption',
      ],
    },
  },

  // Why Section
  why: {
    title: 'Why LLM SPY?',
    subtitle: 'Complete transparency and control over your AI agents',
  },

  // Session Intelligence Section
  sessionIntelligence: {
    badge: 'Coming Soon',
    title: 'Session Intelligence',
    subtitle: 'Automatically groups related LLM interactions into coherent sessions, giving you the full conversation context.',
    mainFeatures: {
      title: 'Smart Conversation Tracking',
      description: 'LLM SPY intelligently detects and groups related requests into sessions. See the complete flow of multi-turn conversations, not just isolated API calls.',
      features: {
        detection: {
          title: 'Automatic Session Detection',
          description: 'Identifies conversation patterns and links related messages together. No manual tagging or session IDs required.',
        },
        context: {
          title: 'Full Conversation Context',
          description: 'View entire conversation threads with preserved context. Understand how your agent builds on previous exchanges.',
        },
      },
    },
  },

  // Gateway Section
  gatewaySection: {
    badge: 'Coming Soon',
    title: 'LLM Translation Gateway',
    subtitle: 'Make any LLM speak any language. Your app talks to "Anthropic" but actually uses GPT-4, or vice versa.',
    universalTranslation: {
      title: 'Universal Format Translation',
      description: 'LLM SPY acts as a translation layer between your application and any LLM provider. Switch between models without changing a single line of code.',
      features: {
        conversion: {
          title: 'Automatic Format Conversion',
          description: 'Seamlessly converts between Anthropic, OpenAI, Google, and other LLM formats. Use any model with any interface.',
        },
        visibility: {
          title: 'Full Request Visibility',
          description: 'See exactly how requests are translated between formats. Debug and understand the conversion process in real-time.',
        },
      },
    },
  },

  // Pricing Section
  pricing: {
    badge: 'Limited Time Offer',
    title: 'Alpha Release Pricing',
    price: '$0',
    subtitle: 'Completely free during alpha',
    description: 'Get full access to all features while we\'re in alpha. Help us build the best LLM monitoring tool.',
    cta: 'Start Free Now',
  },

  // CTA Section
  cta: {
    title: 'Ready to See What Your AI Really Does?',
    subtitle: 'Join the alpha and get complete visibility into your AI agents',
    button: 'Get Started for Free',
  },

  // Footer
  footer: {
    copyright: '© 2025. Made with ❤️ by in New York City.',
  },

  // Common
  common: {
    openApp: 'Open App',
    signIn: 'Sign In',
    getStarted: 'Get Started',
    noCardRequired: 'No credit card required',
    freeDuringAlpha: 'Free during alpha',
  },
} as const
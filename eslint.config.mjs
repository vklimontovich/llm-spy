import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  {
    ignores: ['src/generated/**/*'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.object.name="process"][object.property.name="env"]',
          message:
            'Direct access to process.env is not allowed. Use serverEnv from @/lib/server-env or clientEnv from @/lib/client-env instead.',
        },
      ],
    },
  },
  {
    files: [
      'src/lib/server-env.ts',
      'src/lib/client-env.ts',
      'src/lib/build.ts',
      'src/lib/auth-config.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]

export default eslintConfig

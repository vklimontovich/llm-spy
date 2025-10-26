'use client'

import { createContext, ReactNode, useContext } from 'react'
import { FrontendAppConfig } from '@/lib/frontend-config'

const FrontendAppConfigContext = createContext<FrontendAppConfig | undefined>(
  undefined
)

export function FrontendAppConfigProvider({
  config,
  children,
}: {
  config: FrontendAppConfig
  children: ReactNode
}) {
  return (
    <FrontendAppConfigContext.Provider value={config}>
      {children}
    </FrontendAppConfigContext.Provider>
  )
}

export function useFrontendConfig(): FrontendAppConfig {
  const config = useContext(FrontendAppConfigContext)
  if (config === undefined) {
    throw new Error(
      'useFrontendConfig must be used within a FrontendAppConfigProvider'
    )
  }
  return config
}

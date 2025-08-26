'use client'

import {createContext, useContext, ReactNode} from 'react'

interface WorkspaceContextType {
  workspace: {
    id: string
    slug: string
    name: string
  }
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({
  children,
  workspace
}: {
  children: ReactNode
  workspace: WorkspaceContextType['workspace']
}) {
  return (
    <WorkspaceContext.Provider value={{workspace}}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
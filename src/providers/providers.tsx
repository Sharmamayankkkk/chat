'use client'

import { AppProvider, useAppContext } from './app-provider'
import { CallProvider } from './call-provider'
import { Toaster } from '@/components/ui/toaster'
import { CallDialog } from '@/app/(app)/components/call-dialog'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <CallProviderWrapper>
        {children}
        <CallDialog />
        <Toaster />
      </CallProviderWrapper>
    </AppProvider>
  )
}

function CallProviderWrapper({ children }: { children: React.ReactNode }) {
  const { loggedInUser } = useAppContext()
  return <CallProvider userId={loggedInUser?.id || null}>{children}</CallProvider>
}

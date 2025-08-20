'use client'

import { AppProvider, useAppContext } from './app-provider'
import { CallProvider } from './call-provider'
import { Toaster } from '@/components/ui/toaster'
import { CallDialog } from '@/app/(app)/components/call-dialog'
import { IncomingCallNotification } from '@/app/(app)/components/incoming-call-notification'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <CallProviderWrapper>
        {children}
        <Toaster />
      </CallProviderWrapper>
    </AppProvider>
  )
}

function CallProviderWrapper({ children }: { children: React.ReactNode }) {
  const { loggedInUser } = useAppContext()
  return (
    <CallProvider userId={loggedInUser?.id || null}>
      {children}
      <CallDialog />
      <IncomingCallNotification />
    </CallProvider>
  )
}

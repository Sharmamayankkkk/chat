
'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/providers/app-provider'
import type { User } from '@/lib/'
import { Loader2 } from 'lucide-react'

interface RequestDmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUser: User
}

export function RequestDmDialog({ open, onOpenChange, targetUser }: RequestDmDialogProps) {
  const { sendDmRequest } = useAppContext()
  const [reason, setReason] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    setIsSending(true)
    await sendDmRequest(targetUser.id, reason)
    setIsSending(false)
    onOpenChange(false)
    setReason('')
  }
  
  const handleOpenChange = (isOpen: boolean) => {
      if (!isOpen) {
          setReason('');
          setIsSending(false);
      }
      onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request to Message {targetUser.name}</DialogTitle>
            <DialogDescription>
              Please provide a reason for your request to send a direct message. This will be reviewed by an admin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason for Contact</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`E.g., "I would like to ask ${targetUser.name} about..."`}
              className="mt-2 min-h-[100px]"
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!reason.trim() || isSending}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

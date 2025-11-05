
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
import { Checkbox } from '@/components/ui/checkbox'
import { useAppContext } from '@/providers/app-provider'
import type { User, Message } from '@/lib/'
import { Loader2 } from 'lucide-react'

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userToReport: User
  messageToReport?: Message | null
}

export function ReportDialog({ open, onOpenChange, userToReport, messageToReport }: ReportDialogProps) {
  const { reportUser, blockUser } = useAppContext()
  const [reason, setReason] = React.useState('')
  const [alsoBlock, setAlsoBlock] = React.useState(false)
  const [isSending, setIsSending] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    setIsSending(true)

    await reportUser(userToReport.id, reason, messageToReport?.id)
    if (alsoBlock) {
      await blockUser(userToReport.id)
    }

    setIsSending(false)
    onOpenChange(false)
  }
  
  const handleOpenChange = (isOpen: boolean) => {
      if (!isOpen) {
          setReason('');
          setAlsoBlock(false);
          setIsSending(false);
      }
      onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Report {userToReport.name}</DialogTitle>
            <DialogDescription>
              Your report is anonymous. If you believe this user has violated our community guidelines, please let us know.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             {messageToReport && (
                <div className="text-sm p-3 rounded-md border bg-muted">
                    <p className="font-semibold mb-1">Reporting a specific message:</p>
                    <p className="italic line-clamp-2 text-muted-foreground">"{messageToReport.content || 'Attachment'}"</p>
                </div>
             )}
            <div className="space-y-2">
                <Label htmlFor="reason">Reason for Report</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Why are you reporting @${userToReport.username}?`}
                  className="min-h-[100px]"
                  required
                />
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox id="also-block" checked={alsoBlock} onCheckedChange={(checked) => setAlsoBlock(!!checked)} />
                <Label htmlFor="also-block" className="text-sm font-normal">Also block this user</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!reason.trim() || isSending}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

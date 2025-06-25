
'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowRight, Check, X, CircleSlash, ShieldCheck, Info } from 'lucide-react';
import { createClient } from '@/lib/utils';
import type { DmRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

function DmRequestCard({ request, onUpdate }: { request: DmRequest; onUpdate: (id: number, status: 'approved' | 'rejected') => void; }) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={request.from.avatar_url} alt={request.from.name} />
                            <AvatarFallback>{request.from.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{request.from.name}</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex items-center gap-2">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={request.to.avatar_url} alt={request.to.name} />
                            <AvatarFallback>{request.to.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{request.to.name}</span>
                    </div>
                </div>
                {request.reason && (
                    <div className="flex items-start gap-2.5 text-sm text-muted-foreground border-l-2 pl-3 ml-2">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="italic">"{request.reason}"</p>
                    </div>
                )}
            </div>

            <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                {request.status === 'pending' && (
                    <>
                        <Button variant="outline" size="sm" onClick={() => onUpdate(request.id, 'rejected')}>
                            <X className="mr-2 h-4 w-4" /> Reject
                        </Button>
                        <Button variant="success" size="sm" onClick={() => onUpdate(request.id, 'approved')}>
                            <Check className="mr-2 h-4 w-4" /> Approve
                        </Button>
                    </>
                )}
                {request.status === 'approved' && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="destructive" size="sm" onClick={() => onUpdate(request.id, 'rejected')}>
                                    <CircleSlash className="mr-2 h-4 w-4" /> Revoke
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Revoking will change the status to 'rejected'.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {request.status === 'rejected' && (
                    <Button variant="secondary" size="sm" onClick={() => onUpdate(request.id, 'approved')}>
                       <ShieldCheck className="mr-2 h-4 w-4" /> Re-Approve
                    </Button>
                )}
            </div>
        </div>
    );
}


export function DmRequestManagement() {
  const [requests, setRequests] = useState<DmRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    // No need to set loading true here as it's for background updates
    const { data, error } = await supabase
      .from('dm_requests')
      .select('*, reason, from:profiles!from_user_id(*), to:profiles!to_user_id(*)')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ variant: 'destructive', title: 'Error fetching requests', description: error.message });
      setRequests([]);
    } else {
      setRequests(data as any[] as DmRequest[]);
    }
  }, [supabase, toast]);

  useEffect(() => {
    setIsLoading(true);
    fetchRequests().finally(() => setIsLoading(false));
    
    const channel = supabase
      .channel('dm-requests-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests' }, () => {
          fetchRequests();
      })
      .subscribe();

      return () => {
        supabase.removeChannel(channel);
      }
  }, [fetchRequests, supabase]);

  const handleUpdateRequest = async (id: number, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('dm_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error updating request', description: error.message });
    } else {
      toast({ title: `Request ${status}`, description: 'The request has been successfully updated.' });
      // The realtime subscription will handle the UI update by calling fetchRequests
    }
  };

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);
  const approvedRequests = useMemo(() => requests.filter(r => r.status === 'approved'), [requests]);
  const rejectedRequests = useMemo(() => requests.filter(r => r.status === 'rejected'), [requests]);

  const renderRequestList = (list: DmRequest[], emptyMessage: string) => {
    if (list.length > 0) {
        return (
            <div className="space-y-4">
                {list.map(req => (
                    <DmRequestCard key={req.id} request={req} onUpdate={handleUpdateRequest} />
                ))}
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10">
            <Check className="h-12 w-12 mb-4 text-green-500" />
            <p className="font-bold">All caught up!</p>
            <p className="text-sm">{emptyMessage}</p>
        </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>DM Requests</CardTitle>
          <CardDescription>Approve or reject requests from users to send direct messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
             </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
     <Card>
      <CardHeader>
        <CardTitle>DM Requests ({requests.length})</CardTitle>
        <CardDescription>
          Approve, reject, or revoke requests for users to send direct messages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
            <TabsList>
                <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedRequests.length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedRequests.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="pt-4">
                {renderRequestList(pendingRequests, "There are no pending DM requests.")}
            </TabsContent>
            <TabsContent value="approved" className="pt-4">
                {renderRequestList(approvedRequests, "No requests have been approved yet.")}
            </TabsContent>
            <TabsContent value="rejected" className="pt-4">
                {renderRequestList(rejectedRequests, "No requests have been rejected.")}
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

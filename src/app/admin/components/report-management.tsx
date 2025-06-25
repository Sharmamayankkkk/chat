
'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowRight, Check, X, ShieldCheck, Info, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/utils';
import type { Report } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

function ReportCard({ report, onUpdate }: { report: Report; onUpdate: (id: number, status: 'resolved' | 'dismissed') => void; }) {
    return (
        <div className="flex flex-col p-4 border rounded-lg gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2" title={`Reporter: @${report.reporter?.username}`}>
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={report.reporter?.avatar_url} alt={report.reporter?.name} />
                            <AvatarFallback>{report.reporter?.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{report.reporter?.name}</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex items-center gap-2" title={`Reported User: @${report.reported_user?.username}`}>
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={report.reported_user?.avatar_url} alt={report.reported_user?.name} />
                            <AvatarFallback>{report.reported_user?.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{report.reported_user?.name}</span>
                    </div>
                </div>
                 <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
            </div>

            <div className="flex items-start gap-2.5 text-sm text-muted-foreground border-l-2 pl-3 ml-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="italic">"{report.reason}"</p>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap justify-between mt-2">
                <div>
                  {report.message_id && report.message && (
                     <Button asChild variant="outline" size="sm">
                        <Link href={`/chat/${report.message.chat_id}?highlight=${report.message_id}`}>
                            <MessageSquare className="mr-2 h-4 w-4" /> View Message
                        </Link>
                     </Button>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 self-end">
                    {report.status === 'pending' && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onUpdate(report.id, 'dismissed')}>
                                <X className="mr-2 h-4 w-4" /> Dismiss
                            </Button>
                            <Button variant="success" size="sm" onClick={() => onUpdate(report.id, 'resolved')}>
                                <Check className="mr-2 h-4 w-4" /> Mark as Resolved
                            </Button>
                        </>
                    )}
                    {report.status !== 'pending' && (
                        <Badge variant="secondary" className="capitalize">{report.status}</Badge>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ReportManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*, reporter:profiles!reported_by(*), reported_user:profiles!reported_user_id(*), message:message_id(*)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error fetching reports', description: error.message });
      setReports([]);
    } else {
      setReports(data as any[] as Report[]);
    }
  }, [supabase, toast]);

  useEffect(() => {
    setIsLoading(true);
    fetchReports().finally(() => setIsLoading(false));
    
    const channel = supabase
      .channel('reports-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
          fetchReports();
      })
      .subscribe();

      return () => {
        supabase.removeChannel(channel);
      }
  }, [fetchReports, supabase]);

  const handleUpdateReport = async (id: number, status: 'resolved' | 'dismissed') => {
    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error updating report', description: error.message });
    } else {
      toast({ title: `Report ${status}`, description: 'The report has been successfully updated.' });
    }
  };

  const pendingReports = useMemo(() => reports.filter(r => r.status === 'pending'), [reports]);
  const resolvedReports = useMemo(() => reports.filter(r => r.status === 'resolved'), [reports]);
  const dismissedReports = useMemo(() => reports.filter(r => r.status === 'dismissed'), [reports]);

  const renderReportList = (list: Report[], emptyMessage: string) => {
    if (list.length > 0) {
        return (
            <div className="space-y-4">
                {list.map(req => (
                    <ReportCard key={req.id} report={req} onUpdate={handleUpdateReport} />
                ))}
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10">
            <ShieldCheck className="h-12 w-12 mb-4 text-green-500" />
            <p className="font-bold">All clear!</p>
            <p className="text-sm">{emptyMessage}</p>
        </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-6" />
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
             </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
     <Card>
      <CardHeader>
        <CardTitle>User Reports ({reports.length})</CardTitle>
        <CardDescription>
          Review and take action on user-submitted reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
            <TabsList>
                <TabsTrigger value="pending">Pending ({pendingReports.length})</TabsTrigger>
                <TabsTrigger value="resolved">Resolved ({resolvedReports.length})</TabsTrigger>
                <TabsTrigger value="dismissed">Dismissed ({dismissedReports.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="pt-4">
                {renderReportList(pendingReports, "There are no pending reports.")}
            </TabsContent>
            <TabsContent value="resolved" className="pt-4">
                {renderReportList(resolvedReports, "No reports have been marked as resolved yet.")}
            </TabsContent>
            <TabsContent value="dismissed" className="pt-4">
                {renderReportList(dismissedReports, "No reports have been dismissed.")}
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

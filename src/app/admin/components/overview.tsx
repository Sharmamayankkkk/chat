
'use client'

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, MessagesSquare, ShieldAlert } from "lucide-react"
import { createClient } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminOverview() {
  const [stats, setStats] = useState<{
    userCount: number | null,
    pendingRequestsCount: number | null,
    openReportsCount: number | null
  }>({
    userCount: null,
    pendingRequestsCount: null,
    openReportsCount: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);

      const userCountPromise = supabase.from('profiles').select('*', { count: 'exact', head: true });
      const pendingRequestsPromise = supabase.from('dm_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const openReportsPromise = supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      const [
        { count: userCount, error: userError },
        { count: pendingRequestsCount, error: requestsError },
        { count: openReportsCount, error: reportsError },
      ] = await Promise.all([userCountPromise, pendingRequestsPromise, openReportsPromise]);

      if (userError) console.error("Error fetching user count:", userError);
      if (requestsError) console.error("Error fetching pending requests count:", requestsError);
      if (reportsError) console.error("Error fetching open reports count:", reportsError);

      setStats({
        userCount: userCount ?? 0,
        pendingRequestsCount: pendingRequestsCount ?? 0,
        openReportsCount: openReportsCount ?? 0
      });
      setIsLoading(false);
    };

    fetchStats();
  }, [supabase]);


  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.userCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Total users registered in the application.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending DM Requests
            </CardTitle>
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.pendingRequestsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Requests needing admin approval.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Reports</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.openReportsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              User-submitted reports needing review.
            </p>
          </CardContent>
        </Card>
      </div>
  )
}

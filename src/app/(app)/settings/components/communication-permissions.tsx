
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export function CommunicationPermissions() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Communication Permissions</CardTitle>
                <CardDescription>
                    Manage which users are permitted to send you direct messages.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="font-semibold">Feature Not Yet Implemented</p>
                <p className="text-sm text-muted-foreground">
                    This feature requires database changes and will be available in a future update.
                </p>
            </CardContent>
        </Card>
    );
}

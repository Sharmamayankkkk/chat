// src/app/(app)/page.tsx
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";

export default function AppHome() {
  redirect("/chat");
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <Card className="w-full max-w-md text-center border-0 shadow-none">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icons.logo className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Krishna Connect</CardTitle>
          <CardDescription>
            Select a chat from the sidebar to start messaging.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
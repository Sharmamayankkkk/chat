import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function ChatHomePage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center p-2 border-b gap-2 md:hidden">
        <SidebarTrigger />
        <h1 className="font-semibold text-lg">Krishna Connect</h1>
      </header>
      <div className="flex flex-1 items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center border-0 shadow-none">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icons.logo className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome to Krishna Connect</CardTitle>
            <CardDescription>
              Select a chat from the sidebar to start messaging, or create a new one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

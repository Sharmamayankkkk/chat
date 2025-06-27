
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { UserManagement } from "./components/user-management"
import { AdminOverview } from "./components/overview"
import { DmRequestManagement } from "./components/dm-request-management"
import { ReportManagement } from "./components/report-management"

export default function AdminDashboard() {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="requests">DM Requests</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        <AdminOverview />
      </TabsContent>
      <TabsContent value="users" className="mt-6">
        <UserManagement />
      </TabsContent>
      <TabsContent value="requests" className="mt-6">
        <DmRequestManagement />
      </TabsContent>
      <TabsContent value="reports" className="mt-6">
        <ReportManagement />
      </TabsContent>
    </Tabs>
  )
}

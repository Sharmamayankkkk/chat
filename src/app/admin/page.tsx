
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
    <Tabs defaultValue="overview" className="space-y-4">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="requests">DM Requests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="overview">
        <AdminOverview />
      </TabsContent>
      <TabsContent value="users">
        <UserManagement />
      </TabsContent>
      <TabsContent value="requests">
        <DmRequestManagement />
      </TabsContent>
      <TabsContent value="reports">
        <ReportManagement />
      </TabsContent>
    </Tabs>
  )
}

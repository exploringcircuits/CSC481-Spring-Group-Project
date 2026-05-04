// Admin demo control panel — populated in Phase 6.
// This stub exists so the route resolves and the navbar Admin button works.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { Navigate } from "react-router-dom"

export function AdminPanelPage() {
  const { isStaff, isLoading } = useAuth()
  if (isLoading) return null
  if (!isStaff) return <Navigate to="/leagues" replace />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin demo panel</h1>
        <p className="text-sm text-muted-foreground">
          Presenter shortcuts: reset, seed a demo league, run the draft, simulate weeks, start playoffs.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming up</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Admin actions land in Phase 6 of the marathon. Buttons will hit dedicated backend
            endpoints to reset state, generate demo content, and fast-forward the season.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

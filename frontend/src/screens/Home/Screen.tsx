"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

/**
 * Temporary placeholder landing route to host the (app) shell during P5.
 * Not in mind-map/04's page list (Feed/Challenges/etc. are P6) — this will
 * very likely be replaced once P6 builds Feed at `/feed`.
 */
export function HomeScreen() {
  const user = useAuthStore((state) => state.user);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome{user ? `, ${user.username}` : ""}</CardTitle>
        <CardDescription>This is a temporary landing page for the P5 app shell.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The Feed screen lands here in P6.
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Something interrupted the workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              CareerFlow hit an unexpected issue. Your files on disk are still
              safe, and you can retry from here.
            </p>
            <Button onClick={reset}>Try again</Button>
          </CardContent>
        </Card>
      </body>
    </html>
  );
}

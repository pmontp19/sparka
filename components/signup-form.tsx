"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <div className="flex flex-col gap-6" {...props}>
      <Card {...props}>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Account Registration Disabled</CardTitle>
          <CardDescription>
            New account registration is currently disabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <p className="text-center text-muted-foreground text-sm">
              To request access to this application, please contact the administrator.
            </p>
            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link className="underline underline-offset-4" href="/login">
                Sign in
              </Link>
            </div>
            <Button asChild variant="outline">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-6xl mx-auto">
        <LoginForm className="w-full" />
      </div>
    </div>
  );
}

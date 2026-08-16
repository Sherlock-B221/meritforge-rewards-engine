import type { Metadata } from "next";
import LoginScreen from "@/screens/Login";

export function generateMetadata(): Metadata {
  return {
    title: "Log in · meritforge",
    description: "Log in to your meritforge account.",
  };
}

export default function LoginPage() {
  return <LoginScreen />;
}

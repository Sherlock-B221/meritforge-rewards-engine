import type { Metadata } from "next";
import RegisterScreen from "@/screens/Register";

export function generateMetadata(): Metadata {
  return {
    title: "Register · meritforge",
    description: "Create a meritforge account.",
  };
}

export default function RegisterPage() {
  return <RegisterScreen />;
}

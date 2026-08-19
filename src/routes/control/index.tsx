import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/control/")({
  beforeLoad: () => {
    throw redirect({ to: "/control/dashboard" });
  },
});

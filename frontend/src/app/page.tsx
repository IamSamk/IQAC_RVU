"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRole } from "@/lib/rbac";

export default function Home() {
  const { role, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated) router.replace(role.routes[0].href);
  }, [hydrated, role, router]);

  return null;
}

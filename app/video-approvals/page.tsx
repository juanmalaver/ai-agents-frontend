import { redirect } from "next/navigation";

interface LegacyVideoApprovalsRouteProps {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}

export default async function LegacyVideoApprovalsRoute({
  searchParams,
}: LegacyVideoApprovalsRouteProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  redirect(
    `/approvals/video-approvals${
      query.size > 0 ? `?${query.toString()}` : ""
    }`,
  );
}

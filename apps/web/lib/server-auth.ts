import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiRequestError, getBusinesses, getCurrentUser } from "./api";

export async function requireAuthToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("fintwin_token")?.value;
  if (!token) redirect("/login");
  return token;
}

export async function requireAuthSession() {
  const token = await requireAuthToken();
  try {
    const user = await getCurrentUser({ token });
    return { token, user };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}

export async function requirePersonalSession() {
  const session = await requireAuthSession();
  return session;
}

export async function requireBusinessSession() {
  const session = await requireAuthSession();
  if (session.user.accountType === "business") return session;
  const businesses = await getBusinesses({ token: session.token });
  if (businesses.length === 0) redirect("/dashboard");
  return session;
}

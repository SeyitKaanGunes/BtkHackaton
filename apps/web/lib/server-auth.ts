import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAuthToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("fintwin_token")?.value;
  if (!token) redirect("/login");
  return token;
}

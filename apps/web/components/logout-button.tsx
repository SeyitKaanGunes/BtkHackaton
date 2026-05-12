"use client";

import { LogOut } from "lucide-react";
import { logout as clearServerSession } from "../lib/web-auth";

export function LogoutButton() {
  return (
    <button className="nav-item logout-button" type="button" onClick={handleLogout}>
      <LogOut size={18} />
      <span>Çıkış</span>
    </button>
  );
}

async function handleLogout() {
  window.localStorage.removeItem("fintwin_token");
  await clearServerSession();
  window.location.href = "/login";
}

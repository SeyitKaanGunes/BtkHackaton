"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button className="nav-item logout-button" type="button" onClick={logout}>
      <LogOut size={18} />
      <span>Çıkış</span>
    </button>
  );
}

function logout() {
  window.localStorage.removeItem("fintwin_token");
  document.cookie = "fintwin_token=; path=/; max-age=0; SameSite=Lax";
  window.location.href = "/login";
}

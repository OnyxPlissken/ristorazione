"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActivePath(pathname, href) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebarNav({
  items,
  onNavigate,
  pendingCount = 0,
  showPermissions
}) {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav">
      {items.map((item) => {
        const isReservations = item.page === "reservations";
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            className={active ? "sidebar-link active" : "sidebar-link"}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <span className="nav-label">{item.label}</span>
            {isReservations && pendingCount > 0 ? (
              <span className="nav-badge">{pendingCount}</span>
            ) : null}
          </Link>
        );
      })}

      {showPermissions ? (
        <Link
          className={isActivePath(pathname, "/admin/permessi") ? "sidebar-link active" : "sidebar-link"}
          href="/admin/permessi"
          onClick={onNavigate}
        >
          <span className="nav-label">Permessi</span>
        </Link>
      ) : null}
    </nav>
  );
}

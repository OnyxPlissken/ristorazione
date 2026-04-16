"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActivePath(pathname, href) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupItems(items, showPermissions) {
  const grouped = new Map();

  for (const item of items) {
    const section = item.section || "Altro";

    if (!grouped.has(section)) {
      grouped.set(section, []);
    }

    grouped.get(section).push(item);
  }

  if (showPermissions) {
    if (!grouped.has("Amministrazione")) {
      grouped.set("Amministrazione", []);
    }

    grouped.get("Amministrazione").push({
      href: "/admin/permessi",
      label: "Permessi",
      page: "permissions"
    });
  }

  return [...grouped.entries()];
}

export default function AdminSidebarNav({
  items,
  onNavigate,
  pendingCount = 0,
  showPermissions
}) {
  const pathname = usePathname();
  const groupedItems = groupItems(items, showPermissions);

  return (
    <nav className="sidebar-nav">
      {groupedItems.map(([section, sectionItems]) => (
        <div className="sidebar-nav-group" key={section}>
          <div className="sidebar-nav-group-label">{section}</div>

          <div className="sidebar-nav-group-items">
            {sectionItems.map((item) => {
              const isReservations = item.href === "/admin/prenotazioni";
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
          </div>
        </div>
      ))}
    </nav>
  );
}

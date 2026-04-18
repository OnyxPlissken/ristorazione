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
    const subsection = item.subsection || "Pagine";

    if (!grouped.has(section)) {
      grouped.set(section, {
        description: item.sectionDescription || "",
        subsections: new Map()
      });
    }

    const sectionEntry = grouped.get(section);

    if (!sectionEntry.description && item.sectionDescription) {
      sectionEntry.description = item.sectionDescription;
    }

    if (!sectionEntry.subsections.has(subsection)) {
      sectionEntry.subsections.set(subsection, []);
    }

    sectionEntry.subsections.get(subsection).push(item);
  }

  if (showPermissions) {
    if (!grouped.has("Sistema")) {
      grouped.set("Sistema", {
        description: "Accessi, permessi e moduli tecnici del prodotto.",
        subsections: new Map()
      });
    }

    const sectionEntry = grouped.get("Sistema");

    if (!sectionEntry.subsections.has("Configurazione")) {
      sectionEntry.subsections.set("Configurazione", []);
    }

    sectionEntry.subsections.get("Configurazione").push({
      href: "/admin/permessi",
      label: "Permessi",
      page: "permissions",
      section: "Sistema",
      subsection: "Configurazione"
    });
  }

  return [...grouped.entries()];
}

function flattenItems(items, showPermissions) {
  return groupItems(items, showPermissions).flatMap(([, section]) =>
    [...section.subsections.values()].flatMap((sectionItems) => sectionItems)
  );
}

export default function AdminSidebarNav({
  items,
  onNavigate,
  pendingCount = 0,
  showPermissions,
  variant = "sidebar"
}) {
  const pathname = usePathname();
  const groupedItems = groupItems(items, showPermissions);

  if (variant === "handheld") {
    const flatItems = flattenItems(items, showPermissions);

    return (
      <nav aria-label="Navigazione palmare" className="handheld-nav">
        {flatItems.map((item) => {
          const isReservations = item.href === "/admin/prenotazioni";
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              className={active ? "handheld-nav-link active" : "handheld-nav-link"}
              href={item.href}
              key={`handheld-${item.href}`}
              onClick={onNavigate}
            >
              <span>{item.label}</span>
              {isReservations && pendingCount > 0 ? (
                <span className="nav-badge">{pendingCount}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="sidebar-nav">
      {groupedItems.map(([section, sectionData]) => (
        <div className="sidebar-nav-group" key={section}>
          <div className="sidebar-nav-group-head">
            <div className="sidebar-nav-group-label">{section}</div>
            {sectionData.description ? (
              <p className="sidebar-nav-group-copy">{sectionData.description}</p>
            ) : null}
          </div>

          <div className="sidebar-nav-group-items">
            {[...sectionData.subsections.entries()].map(([subsection, sectionItems]) => (
              <div className="sidebar-nav-subgroup" key={`${section}-${subsection}`}>
                <div className="sidebar-nav-subgroup-label">{subsection}</div>
                <div className="sidebar-nav-subgroup-items">
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
          </div>
        </div>
      ))}
    </nav>
  );
}

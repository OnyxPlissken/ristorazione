import Link from "next/link";
import { AdminDialog } from "../../../components/admin-dialog";
import MenuLocationPicker from "../../../components/menu-location-picker";
import MenuWorkspacePanel from "../../../components/menu-workspace-panel";
import { requireUser } from "../../../lib/auth";
import { saveMenuAction } from "../../../lib/actions/admin-actions";
import { naturalCompare } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

function normalizeParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sortLocations(locations) {
  return [...locations].sort(
    (left, right) =>
      naturalCompare(left.name, right.name) || naturalCompare(left.city || "", right.city || "")
  );
}

function countMenuItems(menu) {
  return menu.sections.reduce((sum, section) => sum + section.items.length, 0);
}

function serializeMenu(menu) {
  return {
    ...menu,
    sections: menu.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        price: Number(item.price)
      }))
    }))
  };
}

function flattenMenus(locations) {
  const byId = new Map();

  for (const location of locations) {
    for (const menu of location.menus) {
      if (!byId.has(menu.id)) {
        byId.set(menu.id, serializeMenu(menu));
      }
    }
  }

  return [...byId.values()].sort(
    (left, right) =>
      naturalCompare(left.name, right.name) || naturalCompare(left.locationSummary || "", right.locationSummary || "")
  );
}

function getMenuHref(menuId) {
  const params = new URLSearchParams();

  if (menuId) {
    params.set("menuId", menuId);
  }

  const query = params.toString();
  return query ? `/admin/menu?${query}` : "/admin/menu";
}

export default async function MenuPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "menus");

  const params = await searchParams;
  const canManageMenus = canAccessPage(user, "menus", "manage");
  const requestedMenuId = normalizeParam(params?.menuId);
  const locations = sortLocations(await getAccessibleLocations(user));
  const flattenedMenus = flattenMenus(locations);
  const selectedMenu = flattenedMenus.find((menu) => menu.id === requestedMenuId) || flattenedMenus[0] || null;
  const allowAllLocations = ["ADMIN", "PROPRIETARIO"].includes(user.role);

  if (!locations.length) {
    return (
      <div className="page-stack">
        <section className="panel-card">
          <div className="panel-header">
            <h2>Menu</h2>
            <p>Nessuna sede assegnata a questo utente. Assegna almeno una sede per gestire il menu.</p>
          </div>
        </section>
      </div>
    );
  }

  const totalSections = flattenedMenus.reduce((sum, menu) => sum + menu.sections.length, 0);
  const totalItems = flattenedMenus.reduce((sum, menu) => sum + countMenuItems(menu), 0);

  return (
    <div className="page-stack">
      {!canManageMenus ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare menu, sezioni e piatti ma non modificarli.</p>
          </div>
        </section>
      ) : null}

      <section className="panel-card menu-workspace">
        <div className="panel-header">
          <div>
            <h2>Gestione menu</h2>
            <p>Catalogo menu a sinistra, workspace operativo a destra.</p>
            <p className="menu-location-meta">
              {flattenedMenus.length} menu su {locations.length} sedi / {totalSections} sezioni / {totalItems} piatti
            </p>
          </div>
          {canManageMenus ? (
            <AdminDialog
              buttonClassName="button button-primary"
              buttonLabel="Nuovo menu"
              description="Crea un nuovo menu per pranzo, cena, degustazione o delivery."
              title="Crea un nuovo menu"
            >
              <form action={saveMenuAction} className="entity-form">
                <div className="form-grid">
                  <label>
                    <span>Nome menu</span>
                    <input name="name" placeholder="Menu principale" required type="text" />
                  </label>
                  <label className="full-width">
                    <span>Descrizione</span>
                    <input
                      name="description"
                      placeholder="Pranzo, cena, degustazione o delivery"
                      type="text"
                    />
                  </label>
                </div>
                <div className="checkbox-grid">
                  <label className="checkbox-item">
                    <input defaultChecked name="isActive" type="checkbox" />
                    <span>Menu attivo</span>
                  </label>
                  <label className="checkbox-item">
                    <input name="deliveryEnabled" type="checkbox" />
                    <span>Valido anche per delivery</span>
                  </label>
                </div>
                <MenuLocationPicker
                  allowAll={allowAllLocations}
                  defaultAll={false}
                  defaultSelectedIds={selectedMenu?.assignedLocationIds || [locations[0]?.id].filter(Boolean)}
                  locations={locations}
                  preferredLocationId={selectedMenu?.assignedLocationIds?.[0] || locations[0]?.id || ""}
                />
                {!allowAllLocations ? (
                  <p className="helper-copy">
                    Il profilo corrente puo&apos; creare menu solo sulle sedi che gestisce direttamente.
                  </p>
                ) : null}
                <button className="button button-primary" type="submit">
                  Salva menu
                </button>
              </form>
            </AdminDialog>
          ) : null}
        </div>

        {flattenedMenus.length ? (
          <div className="menu-page-layout">
            <aside className="section-card menu-catalog-panel">
              <div className="panel-header">
                <div>
                  <h2>Catalogo menu</h2>
                  <p>Seleziona un menu e lavora nel pannello principale.</p>
                </div>
                <div className="row-meta">
                  <span>{flattenedMenus.length} menu</span>
                </div>
              </div>

              <div className="menu-tab-list">
                {flattenedMenus.map((menu) => {
                  const itemCount = countMenuItems(menu);

                  return (
                    <Link
                      className={menu.id === selectedMenu?.id ? "menu-tab active" : "menu-tab"}
                      href={getMenuHref(menu.id)}
                      key={menu.id}
                    >
                      <div className="menu-tab-main">
                        <strong>{menu.name}</strong>
                        <span>{menu.description || "Nessuna descrizione"}</span>
                      </div>

                      <div className="menu-tab-meta">
                        <small className="menu-tab-eyebrow">
                          {menu.appliesToAllLocations ? "Tutte le sedi" : menu.locationSummary}
                        </small>
                        <small>
                          {menu.sections.length} sezioni / {itemCount} piatti
                        </small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </aside>

            {selectedMenu ? (
              <MenuWorkspacePanel
                canManageMenus={canManageMenus}
                allowAllLocations={allowAllLocations}
                locations={locations}
                selectedMenu={selectedMenu}
              />
            ) : null}
          </div>
        ) : (
          <section className="section-card">
            <div className="panel-header">
              <div>
                <h2>Nessun menu configurato</h2>
                <p>Crea il primo menu e decidi subito se vale per una sede, piu&apos; sedi o tutte.</p>
              </div>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

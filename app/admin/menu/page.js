import Link from "next/link";
import { AdminDialog } from "../../../components/admin-dialog";
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

function serializeMenu(menu, location) {
  return {
    ...menu,
    locationId: location.id,
    locationName: location.name,
    locationCity: location.city || "",
    locationAddress: location.address || "",
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
  return locations.flatMap((location) =>
    location.menus.map((menu) => serializeMenu(menu, location))
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
            <p>Lavora direttamente sul menu: la sede resta un attributo del menu e non uno step separato.</p>
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
                    <span>Sede</span>
                    <select defaultValue={selectedMenu?.locationId || locations[0]?.id} name="locationId">
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
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
                <label className="checkbox-item">
                  <input defaultChecked name="isActive" type="checkbox" />
                  <span>Menu attivo</span>
                </label>
                <button className="button button-primary" type="submit">
                  Salva menu
                </button>
              </form>
            </AdminDialog>
          ) : null}
        </div>

        {flattenedMenus.length ? (
          <>
            <div className="menu-tab-list">
              {flattenedMenus.map((menu) => {
                const itemCount = countMenuItems(menu);

                return (
                  <Link
                    className={menu.id === selectedMenu?.id ? "menu-tab active" : "menu-tab"}
                    href={getMenuHref(menu.id)}
                    key={menu.id}
                  >
                    <small className="menu-tab-eyebrow">
                      {menu.locationName}
                      {menu.locationCity ? ` / ${menu.locationCity}` : ""}
                    </small>
                    <strong>{menu.name}</strong>
                    <span>{menu.description || "Nessuna descrizione"}</span>
                    <small>
                      {menu.sections.length} sezioni / {itemCount} piatti / {menu.isActive ? "Attivo" : "Non attivo"}
                    </small>
                  </Link>
                );
              })}
            </div>

            {selectedMenu ? (
              <MenuWorkspacePanel
                canManageMenus={canManageMenus}
                selectedMenu={selectedMenu}
              />
            ) : null}
          </>
        ) : (
          <section className="section-card">
            <div className="panel-header">
              <div>
                <h2>Nessun menu in questa sede</h2>
                <p>Crea il primo menu per iniziare a organizzare sezioni e piatti del locale.</p>
              </div>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

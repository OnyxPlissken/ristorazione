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

function getMenuHref(locationId, menuId) {
  const params = new URLSearchParams();

  if (locationId) {
    params.set("locationId", locationId);
  }

  if (menuId) {
    params.set("menuId", menuId);
  }

  return `/admin/menu?${params.toString()}`;
}

export default async function MenuPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "menus");

  const params = await searchParams;
  const canManageMenus = canAccessPage(user, "menus", "manage");
  const requestedLocationId = normalizeParam(params?.locationId);
  const requestedMenuId = normalizeParam(params?.menuId);
  const locations = sortLocations(await getAccessibleLocations(user));
  const selectedLocation =
    locations.find((location) => location.id === requestedLocationId) || locations[0] || null;
  const selectedMenuRaw =
    selectedLocation?.menus.find((menu) => menu.id === requestedMenuId) || selectedLocation?.menus[0] || null;
  const selectedMenu = selectedMenuRaw ? serializeMenu(selectedMenuRaw) : null;

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

  const totalSections = selectedLocation.menus.reduce((sum, menu) => sum + menu.sections.length, 0);
  const totalItems = selectedLocation.menus.reduce((sum, menu) => sum + countMenuItems(menu), 0);

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
            <p>Lavora una sede alla volta, poi scendi da menu a sezione fino ai singoli piatti.</p>
            <p className="menu-location-meta">
              {selectedLocation.name} / {selectedLocation.city || "Sede"} / {selectedLocation.menus.length} menu /{" "}
              {totalSections} sezioni / {totalItems} piatti
            </p>
          </div>
          {canManageMenus ? (
            <AdminDialog
              buttonClassName="button button-primary"
              buttonLabel="Nuovo menu"
              description="Crea un nuovo menu per pranzo, cena, degustazione o delivery."
              title={`Crea menu per ${selectedLocation.name}`}
            >
              <form action={saveMenuAction} className="entity-form">
                <input name="locationId" type="hidden" value={selectedLocation.id} />
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

        <div className="location-picker-grid">
          {locations.map((location) => {
            const targetMenuId = location.id === selectedLocation.id ? selectedMenu?.id : location.menus[0]?.id;

            return (
              <Link
                className={location.id === selectedLocation.id ? "location-pill active" : "location-pill"}
                href={getMenuHref(location.id, targetMenuId)}
                key={location.id}
              >
                <strong>{location.name}</strong>
                <span>{location.city || "Senza citta'"}</span>
                <small>{location.address || "Indirizzo non impostato"}</small>
              </Link>
            );
          })}
        </div>

        {selectedLocation.menus.length ? (
          <>
            <div className="menu-tab-list">
              {selectedLocation.menus.map((menu) => {
                const itemCount = countMenuItems(menu);

                return (
                  <Link
                    className={menu.id === selectedMenu?.id ? "menu-tab active" : "menu-tab"}
                    href={getMenuHref(selectedLocation.id, menu.id)}
                    key={menu.id}
                  >
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
                selectedLocationId={selectedLocation.id}
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

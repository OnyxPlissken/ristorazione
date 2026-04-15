import Link from "next/link";
import { AdminDialog } from "../../../components/admin-dialog";
import { requireUser } from "../../../lib/auth";
import { MENU_SECTION_TEMPLATES } from "../../../lib/constants";
import {
  saveMenuAction,
  saveMenuItemAction,
  saveMenuSectionAction
} from "../../../lib/actions/admin-actions";
import { euro, naturalCompare } from "../../../lib/format";
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

function renderSectionQuickActions(menu, canManageMenus) {
  if (!canManageMenus) {
    return null;
  }

  const existingSectionNames = new Set(menu.sections.map((section) => section.name.trim().toLowerCase()));
  const availableTemplates = MENU_SECTION_TEMPLATES.filter(
    (template) => !existingSectionNames.has(template.name.trim().toLowerCase())
  );

  if (availableTemplates.length === 0) {
    return null;
  }

  return (
    <div className="section-template-grid">
      {availableTemplates.map((template) => (
        <form action={saveMenuSectionAction} className="section-template-form" key={`${menu.id}-${template.name}`}>
          <input name="menuId" type="hidden" value={menu.id} />
          <input name="name" type="hidden" value={template.name} />
          <input name="sortOrder" type="hidden" value={template.sortOrder} />
          <button className="section-template-chip" type="submit">
            {template.name}
          </button>
        </form>
      ))}
    </div>
  );
}

function MenuItemPreview({ item }) {
  return item.imageUrl ? (
    <img
      alt={item.name}
      className="menu-item-thumb"
      loading="lazy"
      src={item.imageUrl}
    />
  ) : (
    <div className="menu-item-thumb empty">
      <span>Nessuna immagine</span>
    </div>
  );
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
  const selectedMenu =
    selectedLocation?.menus.find((menu) => menu.id === requestedMenuId) || selectedLocation?.menus[0] || null;

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
              <article className="section-card menu-active-panel">
                <div className="menu-admin-header">
                  <div>
                    <h2>{selectedMenu.name}</h2>
                    <p>{selectedMenu.description || "Nessuna descrizione impostata."}</p>
                  </div>
                  <div className="row-meta">
                    <span>{selectedMenu.isActive ? "Menu attivo" : "Menu non attivo"}</span>
                    <span>
                      {selectedMenu.sections.length} sezioni / {countMenuItems(selectedMenu)} piatti
                    </span>
                  </div>
                </div>

                {canManageMenus ? (
                  <div className="page-actions">
                    <AdminDialog
                      buttonLabel="Modifica menu"
                      description="Aggiorna nome, descrizione e stato del menu."
                      title={`Modifica ${selectedMenu.name}`}
                    >
                      <form action={saveMenuAction} className="entity-form">
                        <input name="menuId" type="hidden" value={selectedMenu.id} />
                        <input name="locationId" type="hidden" value={selectedLocation.id} />
                        <div className="form-grid">
                          <label>
                            <span>Nome menu</span>
                            <input defaultValue={selectedMenu.name} name="name" type="text" />
                          </label>
                          <label className="full-width">
                            <span>Descrizione</span>
                            <input
                              defaultValue={selectedMenu.description || ""}
                              name="description"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="entity-footer">
                          <label className="checkbox-item">
                            <input defaultChecked={selectedMenu.isActive} name="isActive" type="checkbox" />
                            <span>{selectedMenu.isActive ? "Attivo" : "Disattivo"}</span>
                          </label>
                          <button className="button button-primary" type="submit">
                            Aggiorna menu
                          </button>
                        </div>
                      </form>
                    </AdminDialog>

                    <AdminDialog
                      buttonLabel="Nuova sezione"
                      description="Aggiungi una sezione personalizzata oltre alle categorie standard."
                      title={`Nuova sezione per ${selectedMenu.name}`}
                    >
                      <form action={saveMenuSectionAction} className="entity-form">
                        <input name="menuId" type="hidden" value={selectedMenu.id} />
                        <div className="form-grid">
                          <label>
                            <span>Nome sezione</span>
                            <input name="name" placeholder="Antipasti" required type="text" />
                          </label>
                          <label>
                            <span>Ordine</span>
                            <input
                              defaultValue={(selectedMenu.sections.at(-1)?.sortOrder || 0) + 10}
                              name="sortOrder"
                              type="number"
                            />
                          </label>
                        </div>
                        <button className="button button-primary" type="submit">
                          Salva sezione
                        </button>
                      </form>
                    </AdminDialog>
                  </div>
                ) : null}

                {renderSectionQuickActions(selectedMenu, canManageMenus)}

                <div className="menu-accordion-stack">
                  {selectedMenu.sections.map((section, index) => (
                    <details className="menu-accordion" key={section.id} open={index === 0}>
                      <summary className="menu-accordion-summary">
                        <div className="menu-accordion-copy">
                          <strong>{section.name}</strong>
                          <p>{section.items.length} piatti in questa sezione</p>
                        </div>
                        <div className="menu-accordion-meta">
                          <span className="location-chip">Ordine {section.sortOrder}</span>
                        </div>
                      </summary>

                      <div className="menu-accordion-body">
                        {canManageMenus ? (
                          <div className="page-actions">
                            <AdminDialog
                              buttonLabel="Modifica sezione"
                              description="Rinomina la sezione o cambia il suo ordine nel menu."
                              title={`Modifica ${section.name}`}
                            >
                              <form action={saveMenuSectionAction} className="entity-form">
                                <input name="menuId" type="hidden" value={selectedMenu.id} />
                                <input name="sectionId" type="hidden" value={section.id} />
                                <div className="form-grid">
                                  <label>
                                    <span>Nome sezione</span>
                                    <input defaultValue={section.name} name="name" type="text" />
                                  </label>
                                  <label>
                                    <span>Ordine</span>
                                    <input defaultValue={section.sortOrder} name="sortOrder" type="number" />
                                  </label>
                                </div>
                                <button className="button button-primary" type="submit">
                                  Aggiorna sezione
                                </button>
                              </form>
                            </AdminDialog>

                            <AdminDialog
                              buttonLabel="Nuovo piatto"
                              description="Aggiungi piatto, prezzo, allergeni e URL immagine."
                              title={`Nuovo piatto in ${section.name}`}
                            >
                              <form action={saveMenuItemAction} className="entity-form">
                                <input name="sectionId" type="hidden" value={section.id} />
                                <div className="form-grid">
                                  <label>
                                    <span>Piatto</span>
                                    <input name="name" placeholder="Risotto al limone" required type="text" />
                                  </label>
                                  <label>
                                    <span>Prezzo</span>
                                    <input defaultValue="0" name="price" step="0.01" type="number" />
                                  </label>
                                  <label className="full-width">
                                    <span>Descrizione</span>
                                    <input name="description" placeholder="Descrizione piatto" type="text" />
                                  </label>
                                  <label className="full-width">
                                    <span>URL immagine</span>
                                    <input name="imageUrl" placeholder="https://..." type="url" />
                                  </label>
                                  <label>
                                    <span>Allergeni</span>
                                    <input
                                      name="allergens"
                                      placeholder="Glutine, lattosio"
                                      type="text"
                                    />
                                  </label>
                                  <label>
                                    <span>Ordine</span>
                                    <input
                                      defaultValue={(section.items.at(-1)?.sortOrder || 0) + 10}
                                      name="sortOrder"
                                      type="number"
                                    />
                                  </label>
                                </div>
                                <label className="checkbox-item">
                                  <input defaultChecked name="available" type="checkbox" />
                                  <span>Disponibile</span>
                                </label>
                                <button className="button button-primary" type="submit">
                                  Salva piatto
                                </button>
                              </form>
                            </AdminDialog>
                          </div>
                        ) : null}

                        {section.items.length ? (
                          <div className="menu-table">
                            <div className="menu-table-head">
                              <span>Foto</span>
                              <span>Piatto</span>
                              <span>Prezzo</span>
                              <span>Stato</span>
                              <span>Allergeni</span>
                              <span>Ordine</span>
                              <span>Azioni</span>
                            </div>

                            {section.items.map((item) => (
                              <article className="menu-table-row" key={item.id}>
                                <div className="menu-table-photo">
                                  <MenuItemPreview item={item} />
                                </div>

                                <div className="menu-table-main">
                                  <span className="menu-cell-label">Piatto</span>
                                  <strong>{item.name}</strong>
                                  <p>{item.description || "Nessuna descrizione impostata."}</p>
                                  {item.imageUrl ? (
                                    <span className="location-chip">Con immagine</span>
                                  ) : null}
                                </div>

                                <div className="menu-table-price">
                                  <span className="menu-cell-label">Prezzo</span>
                                  <strong className="menu-price">{euro(item.price)}</strong>
                                </div>

                                <div className="menu-table-status">
                                  <span className="menu-cell-label">Stato</span>
                                  <span className={item.available ? "location-chip highlighted" : "location-chip empty"}>
                                    {item.available ? "Disponibile" : "Non disponibile"}
                                  </span>
                                </div>

                                <div className="menu-table-allergens">
                                  <span className="menu-cell-label">Allergeni</span>
                                  <span>{item.allergens || "Nessuno"}</span>
                                </div>

                                <div className="menu-table-order">
                                  <span className="menu-cell-label">Ordine</span>
                                  <span>{item.sortOrder}</span>
                                </div>

                                <div className="menu-table-actions">
                                  <span className="menu-cell-label">Azioni</span>
                                  {canManageMenus ? (
                                    <AdminDialog
                                      buttonLabel="Modifica"
                                      description="Aggiorna i dettagli del piatto e l&apos;immagine."
                                      title={`Modifica ${item.name}`}
                                    >
                                      <form action={saveMenuItemAction} className="entity-form">
                                        <input name="itemId" type="hidden" value={item.id} />
                                        <input name="sectionId" type="hidden" value={section.id} />
                                        <div className="form-grid">
                                          <label>
                                            <span>Piatto</span>
                                            <input defaultValue={item.name} name="name" type="text" />
                                          </label>
                                          <label>
                                            <span>Prezzo</span>
                                            <input
                                              defaultValue={Number(item.price)}
                                              name="price"
                                              step="0.01"
                                              type="number"
                                            />
                                          </label>
                                          <label className="full-width">
                                            <span>Descrizione</span>
                                            <input
                                              defaultValue={item.description || ""}
                                              name="description"
                                              type="text"
                                            />
                                          </label>
                                          <label className="full-width">
                                            <span>URL immagine</span>
                                            <input
                                              defaultValue={item.imageUrl || ""}
                                              name="imageUrl"
                                              placeholder="https://..."
                                              type="url"
                                            />
                                          </label>
                                          <label>
                                            <span>Allergeni</span>
                                            <input
                                              defaultValue={item.allergens || ""}
                                              name="allergens"
                                              type="text"
                                            />
                                          </label>
                                          <label>
                                            <span>Ordine</span>
                                            <input defaultValue={item.sortOrder} name="sortOrder" type="number" />
                                          </label>
                                        </div>
                                        <div className="entity-footer">
                                          <label className="checkbox-item">
                                            <input
                                              defaultChecked={item.available}
                                              name="available"
                                              type="checkbox"
                                            />
                                            <span>{item.available ? "Disponibile" : "Non disponibile"}</span>
                                          </label>
                                          <button className="button button-primary" type="submit">
                                            Aggiorna piatto
                                          </button>
                                        </div>
                                      </form>
                                    </AdminDialog>
                                  ) : (
                                    <span className="helper-copy">Sola lettura</span>
                                  )}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-copy">Nessun piatto in questa sezione.</p>
                        )}
                      </div>
                    </details>
                  ))}

                  {selectedMenu.sections.length === 0 ? (
                    <p className="empty-copy">
                      Nessuna sezione configurata. Parti da Antipasti, Primi, Secondi e Bevande.
                    </p>
                  ) : null}
                </div>
              </article>
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

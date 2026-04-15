import { requireUser } from "../../../lib/auth";
import {
  saveMenuAction,
  saveMenuItemAction,
  saveMenuSectionAction
} from "../../../lib/actions/admin-actions";
import { euro } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const user = await requireUser();
  requirePageAccess(user, "menus");
  const canManageMenus = canAccessPage(user, "menus", "manage");

  const locations = await getAccessibleLocations(user);

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

      {locations.map((location) => (
        <section className="panel-card" key={location.id}>
          <div className="panel-header">
            <h2>Menu di {location.name}</h2>
            <p>Gestisci menu, sezioni e piatti.</p>
          </div>

          <form action={saveMenuAction} className="entity-form">
            <input name="locationId" type="hidden" value={location.id} />
            <fieldset className="form-fieldset" disabled={!canManageMenus}>
              <div className="form-grid">
                <label>
                  <span>Nome menu</span>
                  <input name="name" placeholder="Menu principale" type="text" />
                </label>
                <label className="full-width">
                  <span>Descrizione</span>
                  <input name="description" placeholder="Pranzo, cena o degustazione" type="text" />
                </label>
              </div>
              <label className="checkbox-item">
                <input defaultChecked name="isActive" type="checkbox" />
                <span>Menu attivo</span>
              </label>
              <button className="button button-primary" type="submit">
                Salva menu
              </button>
            </fieldset>
          </form>

          <div className="entity-list">
            {location.menus.map((menu) => (
              <div className="entity-card" key={menu.id}>
                <form action={saveMenuAction} className="entity-form nested-form">
                  <input name="menuId" type="hidden" value={menu.id} />
                  <input name="locationId" type="hidden" value={location.id} />
                  <fieldset className="form-fieldset" disabled={!canManageMenus}>
                    <div className="form-grid">
                      <label>
                        <span>Nome menu</span>
                        <input defaultValue={menu.name} name="name" type="text" />
                      </label>
                      <label className="full-width">
                        <span>Descrizione</span>
                        <input defaultValue={menu.description || ""} name="description" type="text" />
                      </label>
                    </div>
                    <div className="entity-footer">
                      <label className="checkbox-item">
                        <input defaultChecked={menu.isActive} name="isActive" type="checkbox" />
                        <span>{menu.isActive ? "Attivo" : "Disattivo"}</span>
                      </label>
                      <button className="button button-primary" type="submit">
                        Aggiorna menu
                      </button>
                    </div>
                  </fieldset>
                </form>

                <form action={saveMenuSectionAction} className="entity-form nested-form">
                  <input name="menuId" type="hidden" value={menu.id} />
                  <fieldset className="form-fieldset" disabled={!canManageMenus}>
                    <div className="form-grid">
                      <label>
                        <span>Nuova sezione</span>
                        <input name="name" placeholder="Antipasti" type="text" />
                      </label>
                      <label>
                        <span>Ordine</span>
                        <input defaultValue="0" name="sortOrder" type="number" />
                      </label>
                    </div>
                    <button className="button button-primary" type="submit">
                      Aggiungi sezione
                    </button>
                  </fieldset>
                </form>

                <div className="section-stack">
                  {menu.sections.map((section) => (
                    <div className="section-card" key={section.id}>
                      <div className="section-title">
                        <strong>{section.name}</strong>
                        <span>Ordine {section.sortOrder}</span>
                      </div>
                      <form action={saveMenuItemAction} className="entity-form nested-form">
                        <input name="sectionId" type="hidden" value={section.id} />
                        <fieldset className="form-fieldset" disabled={!canManageMenus}>
                          <div className="form-grid">
                            <label>
                              <span>Piatto</span>
                              <input name="name" placeholder="Risotto al limone" type="text" />
                            </label>
                            <label>
                              <span>Prezzo</span>
                              <input defaultValue="0" name="price" step="0.01" type="number" />
                            </label>
                            <label className="full-width">
                              <span>Descrizione</span>
                              <input name="description" placeholder="Descrizione piatto" type="text" />
                            </label>
                            <label>
                              <span>Allergeni</span>
                              <input name="allergens" placeholder="Glutine, lattosio" type="text" />
                            </label>
                            <label>
                              <span>Ordine</span>
                              <input defaultValue="0" name="sortOrder" type="number" />
                            </label>
                          </div>
                          <label className="checkbox-item">
                            <input defaultChecked name="available" type="checkbox" />
                            <span>Disponibile</span>
                          </label>
                          <button className="button button-primary" type="submit">
                            Aggiungi piatto
                          </button>
                        </fieldset>
                      </form>

                      <div className="entity-list">
                        {section.items.map((item) => (
                          <form
                            action={saveMenuItemAction}
                            className="entity-card compact"
                            key={item.id}
                          >
                            <input name="itemId" type="hidden" value={item.id} />
                            <input name="sectionId" type="hidden" value={section.id} />
                            <fieldset className="form-fieldset" disabled={!canManageMenus}>
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
                                  <span>
                                    {item.available ? "Disponibile" : "Non disponibile"} / {euro(item.price)}
                                  </span>
                                </label>
                                <button className="button button-primary" type="submit">
                                  Aggiorna piatto
                                </button>
                              </div>
                            </fieldset>
                          </form>
                        ))}
                      </div>
                    </div>
                  ))}
                  {menu.sections.length === 0 ? (
                    <p className="empty-copy">Nessuna sezione configurata.</p>
                  ) : null}
                </div>
              </div>
            ))}
            {location.menus.length === 0 ? (
              <p className="empty-copy">Nessun menu creato per questa sede.</p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

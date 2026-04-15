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

function sortLocations(locations) {
  return [...locations].sort(
    (left, right) =>
      naturalCompare(left.name, right.name) || naturalCompare(left.city || "", right.city || "")
  );
}

function countMenuItems(menu) {
  return menu.sections.reduce((sum, section) => sum + section.items.length, 0);
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

export default async function MenuPage() {
  const user = await requireUser();
  requirePageAccess(user, "menus");
  const canManageMenus = canAccessPage(user, "menus", "manage");
  const locations = sortLocations(await getAccessibleLocations(user));

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

      {locations.map((location) => {
        const totalSections = location.menus.reduce((sum, menu) => sum + menu.sections.length, 0);
        const totalItems = location.menus.reduce((sum, menu) => sum + countMenuItems(menu), 0);

        return (
          <section className="panel-card" key={location.id}>
            <div className="panel-header">
              <div>
                <h2>Menu di {location.name}</h2>
                <p>
                  Gestione piu&apos; ordinata di menu, sezioni e piatti, con immagini e categorie
                  classiche del ristorante.
                </p>
              </div>
              {canManageMenus ? (
                <AdminDialog
                  buttonClassName="button button-primary"
                  buttonLabel="Nuovo menu"
                  description="Crea un nuovo menu per pranzo, cena, degustazione o delivery."
                  title={`Crea menu per ${location.name}`}
                >
                  <form action={saveMenuAction} className="entity-form">
                    <input name="locationId" type="hidden" value={location.id} />
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

            <div className="zone-summary-grid">
              <article className="summary-chip">
                <strong>Menu</strong>
                <span>{location.menus.length} configurati</span>
              </article>
              <article className="summary-chip">
                <strong>Sezioni</strong>
                <span>{totalSections} sezioni totali</span>
              </article>
              <article className="summary-chip">
                <strong>Piatti</strong>
                <span>{totalItems} piatti configurati</span>
              </article>
            </div>

            <div className="entity-list">
              {location.menus.map((menu) => {
                const itemCount = countMenuItems(menu);

                return (
                  <article className="entity-card compact menu-admin-card" key={menu.id}>
                    <div className="menu-admin-header">
                      <div>
                        <h2>{menu.name}</h2>
                        <p>{menu.description || "Nessuna descrizione impostata."}</p>
                      </div>
                      <div className="row-meta">
                        <span>{menu.isActive ? "Menu attivo" : "Menu non attivo"}</span>
                        <span>
                          {menu.sections.length} sezioni / {itemCount} piatti
                        </span>
                      </div>
                    </div>

                    {canManageMenus ? (
                      <div className="page-actions">
                        <AdminDialog
                          buttonLabel="Modifica menu"
                          description="Aggiorna nome, descrizione e stato del menu."
                          title={`Modifica ${menu.name}`}
                        >
                          <form action={saveMenuAction} className="entity-form">
                            <input name="menuId" type="hidden" value={menu.id} />
                            <input name="locationId" type="hidden" value={location.id} />
                            <div className="form-grid">
                              <label>
                                <span>Nome menu</span>
                                <input defaultValue={menu.name} name="name" type="text" />
                              </label>
                              <label className="full-width">
                                <span>Descrizione</span>
                                <input
                                  defaultValue={menu.description || ""}
                                  name="description"
                                  type="text"
                                />
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
                          </form>
                        </AdminDialog>

                        <AdminDialog
                          buttonLabel="Nuova sezione"
                          description="Aggiungi una sezione personalizzata oltre alle categorie standard."
                          title={`Nuova sezione per ${menu.name}`}
                        >
                          <form action={saveMenuSectionAction} className="entity-form">
                            <input name="menuId" type="hidden" value={menu.id} />
                            <div className="form-grid">
                              <label>
                                <span>Nome sezione</span>
                                <input name="name" placeholder="Antipasti" required type="text" />
                              </label>
                              <label>
                                <span>Ordine</span>
                                <input
                                  defaultValue={(menu.sections.at(-1)?.sortOrder || 0) + 10}
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

                    {renderSectionQuickActions(menu, canManageMenus)}

                    <div className="section-stack">
                      {menu.sections.map((section) => (
                        <section className="section-card menu-section-card" key={section.id}>
                          <div className="menu-section-header">
                            <div>
                              <strong>{section.name}</strong>
                              <p>
                                {section.items.length} piatti configurati / ordine {section.sortOrder}
                              </p>
                            </div>
                            {canManageMenus ? (
                              <div className="page-actions">
                                <AdminDialog
                                  buttonLabel="Modifica sezione"
                                  description="Rinomina la sezione o cambia il suo ordine nel menu."
                                  title={`Modifica ${section.name}`}
                                >
                                  <form action={saveMenuSectionAction} className="entity-form">
                                    <input name="menuId" type="hidden" value={menu.id} />
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
                                        <input
                                          name="description"
                                          placeholder="Descrizione piatto"
                                          type="text"
                                        />
                                      </label>
                                      <label className="full-width">
                                        <span>URL immagine</span>
                                        <input
                                          name="imageUrl"
                                          placeholder="https://..."
                                          type="url"
                                        />
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
                          </div>

                          <div className="menu-item-list">
                            {section.items.map((item) => (
                              <article className="menu-item-row" key={item.id}>
                                <MenuItemPreview item={item} />

                                <div className="menu-item-copy">
                                  <div className="menu-item-title-row">
                                    <div>
                                      <strong>{item.name}</strong>
                                      <p>{item.description || "Nessuna descrizione impostata."}</p>
                                    </div>
                                    <strong className="menu-price">{euro(item.price)}</strong>
                                  </div>

                                  <div className="location-chip-list">
                                    <span className={item.available ? "location-chip highlighted" : "location-chip empty"}>
                                      {item.available ? "Disponibile" : "Non disponibile"}
                                    </span>
                                    <span className="location-chip">Ordine {item.sortOrder}</span>
                                    {item.allergens ? (
                                      <span className="location-chip">{item.allergens}</span>
                                    ) : null}
                                    {item.imageUrl ? <span className="location-chip">Con immagine</span> : null}
                                  </div>
                                </div>

                                <div className="menu-item-actions">
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
                                  ) : null}
                                </div>
                              </article>
                            ))}

                            {section.items.length === 0 ? (
                              <p className="empty-copy">Nessun piatto in questa sezione.</p>
                            ) : null}
                          </div>
                        </section>
                      ))}

                      {menu.sections.length === 0 ? (
                        <p className="empty-copy">
                          Nessuna sezione configurata. Parti da Antipasti, Primi, Secondi e Bevande.
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {location.menus.length === 0 ? (
                <p className="empty-copy">Nessun menu creato per questa sede.</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

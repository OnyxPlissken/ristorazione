"use client";

import { useDeferredValue, useState } from "react";
import {
  deleteMenuAction,
  saveMenuAction,
  saveMenuItemAction,
  saveMenuSectionAction
} from "../lib/actions/admin-actions";
import { euro } from "../lib/format";
import { MENU_SECTION_TEMPLATES } from "../lib/constants";
import { AdminDialog } from "./admin-dialog";
import MenuLocationPicker from "./menu-location-picker";

function countMenuItems(menu) {
  return menu.sections.reduce((sum, section) => sum + section.items.length, 0);
}

function matchesItemQuery(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [item.name, item.description, item.allergens].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function filterByAvailability(items, filter) {
  if (filter === "AVAILABLE") {
    return items.filter((item) => item.available);
  }

  if (filter === "UNAVAILABLE") {
    return items.filter((item) => !item.available);
  }

  return items;
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
    <img alt={item.name} className="menu-item-thumb" loading="lazy" src={item.imageUrl} />
  ) : (
    <div className="menu-item-thumb empty">
      <span>Nessuna immagine</span>
    </div>
  );
}

function menuAvailabilityClasses(available) {
  return available ? "menu-availability-chip is-available" : "menu-availability-chip is-unavailable";
}

function menuAvailabilityToggleClasses(available) {
  return available
    ? "checkbox-item menu-availability-toggle is-available"
    : "checkbox-item menu-availability-toggle is-unavailable";
}

export default function MenuWorkspacePanel({
  canManageMenus,
  locations,
  allowAllLocations,
  selectedMenu
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const hasActiveFilters =
    deferredQuery.length > 0 || sectionFilter !== "ALL" || availabilityFilter !== "ALL";

  const filteredSections = selectedMenu.sections.reduce((list, section) => {
    if (sectionFilter !== "ALL" && section.id !== sectionFilter) {
      return list;
    }

    const sectionMatchesQuery = deferredQuery
      ? section.name.toLowerCase().includes(deferredQuery)
      : false;
    const itemsByAvailability = filterByAvailability(section.items, availabilityFilter);
    const filteredItems = deferredQuery
      ? sectionMatchesQuery
        ? itemsByAvailability
        : itemsByAvailability.filter((item) => matchesItemQuery(item, deferredQuery))
      : itemsByAvailability;

    if (deferredQuery && !sectionMatchesQuery && filteredItems.length === 0) {
      return list;
    }

    list.push({
      ...section,
      allItems: section.items,
      items: filteredItems
    });

    return list;
  }, []);

  const visibleItems = filteredSections.reduce((sum, section) => sum + section.items.length, 0);

  function resetFilters() {
    setSearchQuery("");
    setSectionFilter("ALL");
    setAvailabilityFilter("ALL");
  }

  function confirmDelete(event) {
    const confirmed = window.confirm(
      `Vuoi davvero eliminare il menu "${selectedMenu.name}"? Verranno eliminate anche le sue sezioni e i suoi piatti.`
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <article className="section-card menu-active-panel">
      <div className="menu-admin-header">
        <div>
          <h2>{selectedMenu.name}</h2>
          <p>{selectedMenu.description || "Nessuna descrizione impostata."}</p>
          <p className="menu-panel-location">
            Sedi: {selectedMenu.locationSummary || "Nessuna sede assegnata"}
          </p>
        </div>
        <div className="row-meta">
          <span>{selectedMenu.isActive ? "Menu attivo" : "Menu non attivo"}</span>
          <span>{selectedMenu.deliveryEnabled ? "Abilitato delivery" : "Solo sede / sala"}</span>
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
              <div className="form-grid">
                <label>
                  <span>Nome menu</span>
                  <input defaultValue={selectedMenu.name} name="name" type="text" />
                </label>
                <label className="full-width">
                  <span>Descrizione</span>
                  <input defaultValue={selectedMenu.description || ""} name="description" type="text" />
                </label>
              </div>
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input defaultChecked={selectedMenu.isActive} name="isActive" type="checkbox" />
                  <span>{selectedMenu.isActive ? "Attivo" : "Disattivo"}</span>
                </label>
                <label className="checkbox-item">
                  <input defaultChecked={selectedMenu.deliveryEnabled} name="deliveryEnabled" type="checkbox" />
                  <span>{selectedMenu.deliveryEnabled ? "Valido per delivery" : "Non valido per delivery"}</span>
                </label>
              </div>
              <MenuLocationPicker
                allowAll={allowAllLocations}
                defaultAll={selectedMenu.appliesToAllLocations}
                defaultSelectedIds={selectedMenu.assignedLocationIds}
                locations={locations}
                preferredLocationId={selectedMenu.locationId}
              />
              {!allowAllLocations ? (
                <p className="helper-copy">
                  Il profilo corrente puo&apos; assegnare il menu solo alle sedi che gestisce direttamente.
                </p>
              ) : null}
              <button className="button button-primary" type="submit">
                Aggiorna menu
              </button>
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

          <AdminDialog
            buttonClassName="button button-danger"
            buttonLabel="Elimina menu"
            description="Questa azione elimina il menu selezionato insieme a sezioni e piatti collegati."
            title={`Elimina ${selectedMenu.name}`}
          >
            <form action={deleteMenuAction} className="entity-form" onSubmit={confirmDelete}>
              <input name="menuId" type="hidden" value={selectedMenu.id} />
              <div className="note-box">
                <strong>Conferma eliminazione</strong>
                <p>
                  Stai per eliminare il menu <strong>{selectedMenu.name}</strong> della sede{" "}
                  <strong>{selectedMenu.locationName}</strong>. L&apos;operazione non e&apos; reversibile.
                </p>
              </div>
              <button className="button button-danger" type="submit">
                Conferma eliminazione
              </button>
            </form>
          </AdminDialog>
        </div>
      ) : null}

      {renderSectionQuickActions(selectedMenu, canManageMenus)}

      <div className="reservation-toolbar menu-filter-toolbar">
        <label className="search-input-shell">
          <span className="sr-only">Cerca piatto</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cerca piatto, descrizione o allergeni"
            type="search"
            value={searchQuery}
          />
        </label>

        <div className="menu-filter-grid">
          <label>
            <span>Sezione</span>
            <select onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}>
              <option value="ALL">Tutte le sezioni</option>
              {selectedMenu.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Disponibilita'</span>
            <select onChange={(event) => setAvailabilityFilter(event.target.value)} value={availabilityFilter}>
              <option value="ALL">Tutti i piatti</option>
              <option value="AVAILABLE">Solo disponibili</option>
              <option value="UNAVAILABLE">Solo non disponibili</option>
            </select>
          </label>
        </div>
      </div>

      <div className="menu-filter-summary">
        <p>
          {visibleItems} piatti visibili in {filteredSections.length} sezioni
          {deferredQuery ? ` per "${searchQuery.trim()}"` : ""}.
        </p>
        {hasActiveFilters ? (
          <button className="button button-muted" onClick={resetFilters} type="button">
            Azzera filtri
          </button>
        ) : null}
      </div>

      <div className="menu-accordion-stack">
        {filteredSections.map((section, index) => (
          <details className="menu-accordion" key={section.id} open={hasActiveFilters || index === 0}>
            <summary className="menu-accordion-summary">
              <div className="menu-accordion-copy">
                <strong>{section.name}</strong>
                <p>{section.items.length} piatti visibili in questa sezione</p>
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
                          <input name="allergens" placeholder="Glutine, lattosio" type="text" />
                        </label>
                        <label>
                          <span>Ordine</span>
                          <input
                            defaultValue={(section.allItems.at(-1)?.sortOrder || 0) + 10}
                            name="sortOrder"
                            type="number"
                          />
                        </label>
                      </div>
                      <label className={menuAvailabilityToggleClasses(true)}>
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
                        {item.imageUrl ? <span className="location-chip">Con immagine</span> : null}
                      </div>

                      <div className="menu-table-price">
                        <span className="menu-cell-label">Prezzo</span>
                        <strong className="menu-price">{euro(item.price)}</strong>
                      </div>

                      <div className="menu-table-status">
                        <span className="menu-cell-label">Stato</span>
                        <span className={menuAvailabilityClasses(item.available)}>
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
                                  <input defaultValue={item.price} name="price" step="0.01" type="number" />
                                </label>
                                <label className="full-width">
                                  <span>Descrizione</span>
                                  <input defaultValue={item.description || ""} name="description" type="text" />
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
                                  <input defaultValue={item.allergens || ""} name="allergens" type="text" />
                                </label>
                                <label>
                                  <span>Ordine</span>
                                  <input defaultValue={item.sortOrder} name="sortOrder" type="number" />
                                </label>
                              </div>
                              <div className="entity-footer">
                                <label className={menuAvailabilityToggleClasses(item.available)}>
                                  <input defaultChecked={item.available} name="available" type="checkbox" />
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
                <p className="empty-copy">Nessun piatto visibile in questa sezione con i filtri attivi.</p>
              )}
            </div>
          </details>
        ))}

        {filteredSections.length === 0 ? (
          <p className="empty-copy">Nessun risultato con i filtri attivi. Prova a cambiare sezione o disponibilita'.</p>
        ) : null}
      </div>
    </article>
  );
}

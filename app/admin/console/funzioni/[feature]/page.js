import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveActiveLocation } from "../../../../../lib/active-location";
import { requireUser } from "../../../../../lib/auth";
import { saveYieldFeatureRulesAction } from "../../../../../lib/actions/admin-actions";
import { canAccessPage, requirePageAccess } from "../../../../../lib/permissions";
import { getAdminConsoleLocations } from "../../../../../lib/queries";
import {
  YIELD_FEATURE_DEFINITIONS,
  YIELD_RULE_APPLY_OPTIONS,
  getYieldFeatureDefinition,
  getYieldRuleControlValue,
  getYieldRuleStatusLabel,
  normalizeYieldRuleSettings
} from "../../../../../lib/yield-rules";

export const dynamic = "force-dynamic";

function RuleMetric({ label, value }) {
  return (
    <div className="console-overview-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function countEditableValues(rules) {
  return rules.reduce((total, rule) => total + 3 + rule.controls.length, 0);
}

function ruleApplyDescription(value) {
  return (
    YIELD_RULE_APPLY_OPTIONS.find((option) => option.value === value)?.description ||
    "Scegli quando questa regola deve pesare nelle automazioni."
  );
}

function RuleControl({ control, rule }) {
  return (
    <label>
      <span>
        {control.label}
        {control.unit ? ` (${control.unit})` : ""}
      </span>
      <input
        defaultValue={getYieldRuleControlValue(rule, control.key)}
        max={control.max}
        min={control.min}
        name={`${rule.key}.${control.key}`}
        step={control.step || "1"}
        type={control.type || "number"}
      />
      {control.help ? <small className="field-help">{control.help}</small> : null}
    </label>
  );
}

export default async function YieldFeatureRulesPage({ params }) {
  const user = await requireUser();
  requirePageAccess(user, "console");
  const canManageConsole = canAccessPage(user, "console", "manage");
  const { feature: featureSlug } = await params;
  const feature = getYieldFeatureDefinition(featureSlug);

  if (!feature) {
    notFound();
  }

  const locations = await getAdminConsoleLocations();
  const { activeLocation: selectedLocation } = await resolveActiveLocation(user, locations);

  if (!selectedLocation) {
    return (
      <div className="page-stack">
        <section className="panel-card">
          <div className="panel-header">
            <h2>{feature.title}</h2>
            <p>Nessuna sede disponibile.</p>
          </div>
        </section>
      </div>
    );
  }

  const technical = selectedLocation.technicalSettings || {};
  const ruleSettings = normalizeYieldRuleSettings(technical.yieldRuleSettings || {});
  const featureRules = feature.rules.map((ruleDefinition) => ({
    ...ruleDefinition,
    state: ruleSettings.rules[ruleDefinition.key]
  }));
  const activeRules = featureRules.filter((rule) => rule.state?.enabled).length;

  return (
    <div className="page-stack">
      {!canManageConsole ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare le regole, ma non modificarle.</p>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>{feature.title}</h2>
            <p>{feature.promise}</p>
          </div>
          <div className="row-meta">
            <span>{selectedLocation.name}</span>
            <span>{technical.yieldEngineEnabled ? "Motore attivo" : "Motore spento"}</span>
          </div>
        </div>

        <div className="console-overview-strip">
          <RuleMetric label="Regole attive" value={`${activeRules}/${featureRules.length}`} />
          <RuleMetric label="Valori modificabili" value={countEditableValues(featureRules)} />
          <RuleMetric label="Applicazione" value="Per regola" />
          <RuleMetric label="Salvataggio" value="Subito attivo" />
        </div>
      </section>

      <section className="panel-card console-workspace-panel">
        <aside className="console-side-rail">
          <div className="console-side-head">
            <h2>Funzioni</h2>
            <p>Scegli un set di regole e modificalo senza toccare codice.</p>
          </div>

          <div className="console-feature-nav">
            {YIELD_FEATURE_DEFINITIONS.map((item) => (
              <Link
                className={
                  item.slug === feature.slug
                    ? "console-feature-link active"
                    : "console-feature-link"
                }
                href={`/admin/console/funzioni/${item.slug}`}
                key={item.slug}
              >
                <span className="location-chip">{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <span>{item.rules.length} regole</span>
              </Link>
            ))}
          </div>

          <div className="note-box">
            <strong>In pratica</strong>
            <p>{feature.description}</p>
          </div>

          <Link className="button button-muted button-full" href="/admin/console?section=operativita&panel=yield">
            Torna alla console
          </Link>
        </aside>

        <div className="console-main-workspace">
          <form action={saveYieldFeatureRulesAction} className="entity-form">
            <input name="featureSlug" type="hidden" value={feature.slug} />
            <input name="locationId" type="hidden" value={selectedLocation.id} />

            <fieldset className="form-fieldset" disabled={!canManageConsole}>
              <section className="console-block">
                <div className="console-block-head">
                  <h4>Accensione modulo</h4>
                  <p>Se e' spento, puoi salvare le regole ma non guidano le assegnazioni.</p>
                </div>

                <label className="checkbox-item yield-rule-module-toggle">
                  <input
                    defaultChecked={Boolean(technical.yieldEngineEnabled)}
                    name="yieldEngineEnabled"
                    type="checkbox"
                  />
                  <span>Motore resa sala attivo</span>
                </label>
              </section>

              <div className="yield-rule-list">
                {featureRules.map((rule) => (
                  <section className="console-block yield-rule-card" key={rule.key}>
                    <div className="yield-rule-card-head">
                      <div>
                        <label className="checkbox-item">
                          <input
                            defaultChecked={Boolean(rule.state?.enabled)}
                            name={`${rule.key}.enabled`}
                            type="checkbox"
                          />
                          <span>{rule.title}</span>
                        </label>
                        <p className="yield-rule-copy">{rule.description}</p>
                      </div>
                      <span className="location-chip highlighted">
                        {getYieldRuleStatusLabel(rule.state)}
                      </span>
                    </div>

                    {rule.plainCopy ? (
                      <p className="yield-rule-plain">{rule.plainCopy}</p>
                    ) : null}

                    <div className="yield-rule-settings-grid">
                      <label>
                        <span>Quando usarla</span>
                        <select
                          defaultValue={rule.state?.applyWhen || rule.defaultApplyWhen}
                          name={`${rule.key}.applyWhen`}
                        >
                          {YIELD_RULE_APPLY_OPTIONS.map((option) => (
                            <option key={`${rule.key}-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Quanto pesa</span>
                        <input
                          defaultValue={rule.state?.priority ?? rule.defaultPriority}
                          max="100"
                          min="0"
                          name={`${rule.key}.priority`}
                          type="number"
                        />
                      </label>
                      {rule.controls.map((control) => (
                        <RuleControl
                          control={control}
                          key={`${rule.key}-${control.key}`}
                          rule={rule.state}
                        />
                      ))}
                    </div>

                    <div className="note-box yield-rule-note">
                      <strong>
                        {YIELD_RULE_APPLY_OPTIONS.find(
                          (option) =>
                            option.value === (rule.state?.applyWhen || rule.defaultApplyWhen)
                        )?.label || "Attiva"}
                      </strong>
                      <p>{ruleApplyDescription(rule.state?.applyWhen || rule.defaultApplyWhen)}</p>
                    </div>
                  </section>
                ))}
              </div>

              <div className="section-submit-bar">
                <button className="button button-primary" type="submit">
                  Salva regole {feature.title}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </section>
    </div>
  );
}

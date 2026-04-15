"use client";

import { useEffect, useId, useState } from "react";

export function AdminDialog({
  buttonLabel,
  buttonClassName = "button button-muted",
  title,
  description,
  children
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSubmit(event) {
    if (event.defaultPrevented) {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLFormElement)) {
      return;
    }

    window.setTimeout(() => {
      setOpen(false);
    }, 0);
  }

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)} type="button">
        {buttonLabel}
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="modal-shell"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id={titleId}>{title}</h2>
                {description ? <p>{description}</p> : null}
              </div>

              <button
                aria-label="Chiudi finestra"
                className="modal-close"
                onClick={() => setOpen(false)}
                type="button"
              >
                Chiudi
              </button>
            </div>

            <div className="modal-body">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

type RenameThreadPromptProps = {
  name: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RenameThreadPrompt({
  name,
  onChange,
  onCancel,
  onConfirm,
}: RenameThreadPromptProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="thread-rename-dialog" role="dialog" aria-modal="true">
      <div className="thread-rename-dialog-backdrop" onClick={onCancel} />
      <div className="thread-rename-dialog-card">
        <div className="thread-rename-dialog-header">
          <h2 className="thread-rename-dialog-title">{t("threads.renameThread")}</h2>
        </div>
        <div className="thread-rename-dialog-field">
          <label className="thread-rename-dialog-label" htmlFor="thread-rename">
            {t("threads.newName")}
          </label>
          <input
            id="thread-rename"
            ref={inputRef}
            className="thread-rename-dialog-input"
            value={name}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
              if (event.key === "Enter") {
                event.preventDefault();
                onConfirm();
              }
            }}
          />
        </div>
        <div className="thread-rename-dialog-actions">
          <button
            className="thread-rename-dialog-button ghost"
            onClick={onCancel}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className="thread-rename-dialog-button primary"
            onClick={onConfirm}
            type="button"
            disabled={name.trim().length === 0}
          >
            {t("threads.rename")}
          </button>
        </div>
      </div>
    </div>
  );
}

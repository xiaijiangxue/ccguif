import type { LspLocationLike } from "../utils/fileViewNavigationUtils";
import { relativePathFromFileUri } from "../utils/fileViewNavigationUtils";

type FileViewNavigationPanelProps = {
  workspacePath: string;
  navigationError: string | null;
  definitionCandidates: LspLocationLike[];
  onCloseDefinitionCandidates: () => void;
  implementationCandidates: LspLocationLike[];
  onCloseImplementationCandidates: () => void;
  referenceResults: LspLocationLike[] | null;
  onCloseReferenceResults: () => void;
  onNavigateToLocation: (location: LspLocationLike) => void;
  t: (key: string) => string;
};

function LocationListItem({
  location,
  workspacePath,
  onNavigateToLocation,
}: {
  location: LspLocationLike;
  workspacePath: string;
  onNavigateToLocation: (location: LspLocationLike) => void;
}) {
  const relativePath = relativePathFromFileUri(location.uri, workspacePath);
  const path = relativePath || location.uri;
  return (
    <li key={`${location.uri}-${location.line}-${location.character}`}>
      <button
        type="button"
        className="fvp-navigation-item"
        onClick={() => onNavigateToLocation(location)}
      >
        <span className="fvp-navigation-path" title={path}>
          {path}
        </span>
        <span className="fvp-navigation-line">
          L{location.line + 1}:C{location.character + 1}
        </span>
      </button>
    </li>
  );
}

export function FileViewNavigationPanel({
  workspacePath,
  navigationError,
  definitionCandidates,
  onCloseDefinitionCandidates,
  implementationCandidates,
  onCloseImplementationCandidates,
  referenceResults,
  onCloseReferenceResults,
  onNavigateToLocation,
  t,
}: FileViewNavigationPanelProps) {
  const hasDefinitionCandidates = definitionCandidates.length > 0;
  const hasImplementationCandidates = implementationCandidates.length > 0;
  const hasReferenceResults = referenceResults !== null;
  if (!navigationError && !hasDefinitionCandidates && !hasImplementationCandidates && !hasReferenceResults) {
    return null;
  }

  return (
    <div className="fvp-navigation-panel">
      {navigationError ? (
        <div className="fvp-navigation-error">{navigationError}</div>
      ) : null}
      {hasDefinitionCandidates ? (
        <div className="fvp-navigation-section">
          <div className="fvp-navigation-header">
            <span>{t("files.definitionCandidates")}</span>
            <button
              type="button"
              className="ghost fvp-navigation-close"
              onClick={onCloseDefinitionCandidates}
            >
              {t("common.close")}
            </button>
          </div>
          <ul className="fvp-navigation-list">
            {definitionCandidates.map((location, index) => (
              <LocationListItem
                key={`${location.uri}-${location.line}-${location.character}-${index}`}
                location={location}
                workspacePath={workspacePath}
                onNavigateToLocation={onNavigateToLocation}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {hasImplementationCandidates ? (
        <div className="fvp-navigation-section">
          <div className="fvp-navigation-header">
            <span>{t("files.implementationCandidates")}</span>
            <button
              type="button"
              className="ghost fvp-navigation-close"
              onClick={onCloseImplementationCandidates}
            >
              {t("common.close")}
            </button>
          </div>
          <ul className="fvp-navigation-list">
            {implementationCandidates.map((location, index) => (
              <LocationListItem
                key={`${location.uri}-${location.line}-${location.character}-${index}`}
                location={location}
                workspacePath={workspacePath}
                onNavigateToLocation={onNavigateToLocation}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {hasReferenceResults ? (
        <div className="fvp-navigation-section">
          <div className="fvp-navigation-header">
            <span>{t("files.referenceResults")}</span>
            <button
              type="button"
              className="ghost fvp-navigation-close"
              onClick={onCloseReferenceResults}
            >
              {t("common.close")}
            </button>
          </div>
          {referenceResults && referenceResults.length > 0 ? (
            <ul className="fvp-navigation-list">
              {referenceResults.map((location, index) => (
                <LocationListItem
                  key={`${location.uri}-${location.line}-${location.character}-${index}`}
                  location={location}
                  workspacePath={workspacePath}
                  onNavigateToLocation={onNavigateToLocation}
                />
              ))}
            </ul>
          ) : (
            <div className="fvp-navigation-empty">{t("files.noReferencesFound")}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

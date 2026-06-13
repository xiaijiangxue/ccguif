import Tooltip from "antd/es/tooltip";

export type ProviderStatus = "ready" | "indexing" | "unavailable" | "error" | "unknown";

export type ProviderStatusBadgeProps = {
  label: string;
  status: ProviderStatus;
  tooltip?: string;
};

const STATUS_COLORS: Record<ProviderStatus, string> = {
  ready: "#52c41a",
  indexing: "#faad14",
  unavailable: "#ff4d4f",
  error: "#ff4d4f",
  unknown: "#d9d9d9",
};

const STATUS_LABELS: Record<ProviderStatus, string> = {
  ready: "Ready",
  indexing: "Indexing...",
  unavailable: "Unavailable",
  error: "Error",
  unknown: "Unknown",
};

export function ProviderStatusBadge({ label, status, tooltip }: ProviderStatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const statusText = STATUS_LABELS[status];
  const displayTooltip = tooltip ?? `${label}: ${statusText}`;

  return (
    <Tooltip title={displayTooltip}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: "#8c8c8c",
          cursor: "default",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: color,
            display: "inline-block",
          }}
        />
        <span>{label}</span>
      </span>
    </Tooltip>
  );
}

import { useTranslation } from 'react-i18next';
import type { TokenIndicatorProps } from './types';

/**
 * TokenIndicator - Usage ring progress bar component
 * Implemented using SVG dual-circle approach
 */
export const TokenIndicator = ({
  percentage,
  size = 14,
  usedTokens,
  maxTokens,
  claudeContextUsage = null,
}: TokenIndicatorProps) => {
  const { t } = useTranslation();
  // Circle radius (accounting for stroke space)
  const radius = (size - 3) / 2;
  const center = size / 2;

  // Circumference
  const circumference = 2 * Math.PI * radius;
  const preferredPercentage = claudeContextUsage?.usedPercent ?? percentage;
  const resolvedPercentage = typeof preferredPercentage === 'number' && isFinite(preferredPercentage)
    ? Math.max(preferredPercentage, 0)
    : null;
  const clampedPercentage = resolvedPercentage !== null
    ? Math.min(resolvedPercentage, 100)
    : 0;

  // Calculate offset (fill clockwise from top)
  const strokeOffset = circumference * (1 - clampedPercentage / 100);

  // Round percentage to one decimal place, but hide trailing .0
  const formatPercent = (value: number | null) => {
    if (value === null) {
      return '...';
    }
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded)
      ? `${Math.round(rounded)}%`
      : `${rounded.toFixed(1)}%`;
  };

  const formattedPercentage = formatPercent(resolvedPercentage === null ? null : clampedPercentage);

  const formatTokens = (value?: number | null) => {
    if (typeof value !== 'number' || !isFinite(value)) return undefined;
    // Always display capacity in k (thousands) units
    // e.g.: 1,000,000 -> 1000k, 500,000 -> 500k
    if (value >= 1_000) {
      const kValue = value / 1_000;
      // If it's a whole number, don't show decimal point
      return Number.isInteger(kValue) ? `${kValue}k` : `${kValue.toFixed(1)}k`;
    }
    return `${value}`;
  };

  const usedText = formatTokens(usedTokens);
  const maxText = formatTokens(maxTokens);
  const totalText = formatTokens(claudeContextUsage?.totalTokens);
  const inputText = formatTokens(claudeContextUsage?.inputTokens);
  const cachedText = formatTokens(claudeContextUsage?.cachedInputTokens);
  const outputText = formatTokens(claudeContextUsage?.outputTokens);
  const claudeUsedText = formatTokens(claudeContextUsage?.usedTokens);
  const claudeMaxText = formatTokens(claudeContextUsage?.contextWindow);
  const claudeUsedPercent = formatPercent(
    claudeContextUsage?.usedPercent !== null && claudeContextUsage?.usedPercent !== undefined
      ? Math.min(Math.max(claudeContextUsage.usedPercent, 0), 100)
      : (resolvedPercentage === null ? null : clampedPercentage),
  );
  const claudeRemainingPercent = formatPercent(
    claudeContextUsage?.remainingPercent !== null && claudeContextUsage?.remainingPercent !== undefined
      ? Math.min(Math.max(claudeContextUsage.remainingPercent, 0), 100)
      : null,
  );
  const claudeFreshness = claudeContextUsage?.freshness ?? 'pending';
  const claudeFreshnessLabel = t(`chat.claudeContextFreshness.${claudeFreshness}`, {
    defaultValue: t('chat.claudeContextFreshness.unknown'),
  });
  const claudeFreshnessChipLabel = claudeFreshness === 'live'
    ? '实时'
    : claudeFreshness === 'restored'
      ? '恢复'
      : claudeFreshness === 'estimated'
        ? '估算'
        : '等待';
  const claudeWindowUnavailableLabel = claudeFreshness === 'estimated'
    ? t('chat.claudeContextWindowCapacityPending')
    : t('chat.claudeContextUnavailable');
  const claudeWindowTokensValue = claudeUsedText && claudeMaxText
    ? `${claudeUsedText} / ${claudeMaxText}`
    : claudeUsedText
      ? t(
        claudeFreshness === 'live'
          ? 'chat.claudeContextWindowUsedOnly'
          : 'chat.claudeContextWindowEstimatedTokens',
        { tokens: claudeUsedText },
      )
      : claudeWindowUnavailableLabel;
  const tooltip = usedText && maxText
    ? `${formattedPercentage} · ${usedText} / ${maxText} ${' '}${t('chat.context')}`
    : t('chat.usagePercentage', { percentage: formattedPercentage });
  const claudeCachedNote = cachedText
    ? t('chat.claudeContextCachedExcludedDetail', { tokens: cachedText })
    : null;
  const claudeEstimatedNote = t('chat.claudeContextEstimatedWindow');
  const claudeWindowSummary = claudeUsedText ?? claudeWindowUnavailableLabel;
  const categoryUsages = claudeContextUsage?.categoryUsages ?? [];
  const tokenIndicatorClassName = [
    'token-indicator',
    resolvedPercentage === null ? 'token-indicator--pending' : null,
    claudeContextUsage ? 'token-indicator--claude' : null,
  ].filter(Boolean).join(' ');
  const tooltipClassName = [
    'token-tooltip',
    claudeContextUsage ? 'token-tooltip--claude' : null,
  ].filter(Boolean).join(' ');

  return (
    <div className={tokenIndicatorClassName}>
      <div className="token-indicator-wrap">
        <svg
          className="token-indicator-ring"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            className="token-indicator-bg"
            cx={center}
            cy={center}
            r={radius}
          />
          {/* Progress arc */}
          <circle
            className="token-indicator-fill"
            cx={center}
            cy={center}
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
          />
        </svg>
        {/* Hover tooltip */}
        <div className={tooltipClassName}>
          {claudeContextUsage ? (
            <div className="claude-context-tooltip">
              <div className="claude-context-tooltip-header">
                <div className="claude-context-tooltip-heading">
                  <span className="claude-context-tooltip-brand">Claude</span>
                </div>
                <span className="claude-context-tooltip-chip">
                  {claudeFreshnessChipLabel}
                </span>
              </div>
              <div className="claude-context-tooltip-summary">
                <div className="claude-context-tooltip-pill">
                  <span className="claude-context-tooltip-pill-label">
                    {t('chat.claudeContextTooltipTotalLabel')}
                  </span>
                  <span className="claude-context-tooltip-pill-value">
                    {totalText ?? t('chat.claudeContextPending')}
                  </span>
                </div>
                <div className="claude-context-tooltip-pill">
                  <span className="claude-context-tooltip-pill-label">
                    {t('chat.claudeContextTooltipWindowTokensLabel')}
                  </span>
                  <span className="claude-context-tooltip-pill-value">
                    {claudeWindowSummary}
                  </span>
                </div>
              </div>

              <div className="claude-context-tooltip-stats">
                <div className="claude-context-tooltip-stat">
                  <span className="claude-context-tooltip-stat-label">input</span>
                  <span className="claude-context-tooltip-stat-value">
                    {inputText ?? t('chat.claudeContextPending')}
                  </span>
                </div>
                <div className="claude-context-tooltip-stat">
                  <span className="claude-context-tooltip-stat-label">output</span>
                  <span className="claude-context-tooltip-stat-value">
                    {outputText ?? t('chat.claudeContextPending')}
                  </span>
                </div>
                <div className="claude-context-tooltip-stat">
                  <span className="claude-context-tooltip-stat-label">cached</span>
                  <span className="claude-context-tooltip-stat-value">
                    {cachedText ?? t('chat.claudeContextPending')}
                  </span>
                </div>
                <div className="claude-context-tooltip-stat">
                  <span className="claude-context-tooltip-stat-label">
                    {t('chat.contextDualViewTooltipRemainingLabel')}
                  </span>
                  <span className="claude-context-tooltip-stat-value">
                    {claudeRemainingPercent}
                  </span>
                </div>
                <div className="claude-context-tooltip-stat">
                  <span className="claude-context-tooltip-stat-label">
                    {t('chat.contextDualViewTooltipUsedLabel')}
                  </span>
                  <span className="claude-context-tooltip-stat-value">
                    {claudeUsedPercent}
                  </span>
                </div>
                <div className="claude-context-tooltip-stat">
                  <span className="claude-context-tooltip-stat-label">window</span>
                  <span className="claude-context-tooltip-stat-value">
                    {claudeWindowTokensValue}
                  </span>
                </div>
              </div>

              {categoryUsages.length > 0 ? (
                <div className="claude-context-tooltip-categories">
                  <div className="claude-context-tooltip-categories-title">
                    {t('chat.claudeContextCategoryTitle')}
                  </div>
                  <div className="claude-context-tooltip-categories-grid">
                    {categoryUsages.map((usage) => {
                      const tokens = formatTokens(usage.tokens) ?? String(usage.tokens);
                      const percent = typeof usage.percent === 'number' && isFinite(usage.percent)
                        ? formatPercent(usage.percent)
                        : null;

                      return (
                        <span className="claude-context-tooltip-category-chip" key={`${usage.name}:${usage.tokens}`}>
                          <span className="claude-context-tooltip-category-name">{usage.name}</span>
                          <span className="claude-context-tooltip-category-value">
                            {tokens}
                            {percent ? ` · ${percent}` : ''}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="claude-context-tooltip-divider" />
              <div className="claude-context-tooltip-footnote">
                {claudeEstimatedNote}
                {claudeCachedNote ? `，${claudeCachedNote}` : ''}
              </div>
              {claudeFreshness !== 'estimated' ? (
                <div className="claude-context-tooltip-source">
                  {claudeFreshnessLabel}
                </div>
              ) : null}
            </div>
          ) : (
            tooltip
          )}
        </div>
      </div>
      {resolvedPercentage !== null ? (
        <span className="token-percentage-label">{formattedPercentage}</span>
      ) : null}
    </div>
  );
};

export default TokenIndicator;

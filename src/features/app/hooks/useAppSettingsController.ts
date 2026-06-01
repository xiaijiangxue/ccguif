import { useThemePreference } from "../../layout/hooks/useThemePreference";
import { useTransparencyPreference } from "../../layout/hooks/useTransparencyPreference";
import { useUiScaleShortcuts } from "../../layout/hooks/useUiScaleShortcuts";
import { useAppSettings } from "../../settings/hooks/useAppSettings";
import { useUserMessageBubbleColor } from "./useUserMessageBubbleColor";

export function useAppSettingsController() {
  const {
    settings: appSettings,
    setSettings: setAppSettings,
    saveSettings,
    doctor,
    claudeDoctor,
    isLoading: appSettingsLoading,
  } = useAppSettings();

  useThemePreference(appSettings);
  useUserMessageBubbleColor(appSettings.userMsgColor);
  const {
    reduceTransparency,
    setReduceTransparency,
    windowTransparencyEnabled,
    setWindowTransparencyEnabled,
    windowOpacity,
    setWindowOpacity,
  } =
    useTransparencyPreference();

  const {
    uiScale,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
  } = useUiScaleShortcuts({
    settings: appSettings,
    setSettings: setAppSettings,
    saveSettings,
  });

  return {
    appSettings,
    setAppSettings,
    saveSettings,
    queueSaveSettings,
    doctor,
    claudeDoctor,
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    windowTransparencyEnabled,
    setWindowTransparencyEnabled,
    windowOpacity,
    setWindowOpacity,
    uiScale,
    scaleShortcutTitle,
    scaleShortcutText,
  };
}

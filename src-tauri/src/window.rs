use serde::Serialize;
use tauri::{Theme, Window};

const WINDOW_OPACITY_MIN: f64 = 0.55;
const WINDOW_OPACITY_MAX: f64 = 1.0;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowOpacityApplyResult {
    requested_opacity: f64,
    applied_opacity: f64,
    applied: bool,
    platform: &'static str,
    reason: Option<String>,
}

#[cfg(test)]
use std::sync::{Mutex, OnceLock};

#[cfg(test)]
type WindowAppearanceOverride =
    Box<dyn Fn(&Window, &str) -> Result<(), String> + Send + Sync + 'static>;

#[cfg(test)]
static WINDOW_APPEARANCE_OVERRIDE: OnceLock<Mutex<Option<WindowAppearanceOverride>>> =
    OnceLock::new();

#[cfg(target_os = "macos")]
fn apply_macos_window_appearance(window: &Window, theme: &str) -> Result<(), String> {
    use objc2_app_kit::{
        NSAppearance, NSAppearanceCustomization, NSAppearanceNameAqua, NSAppearanceNameDarkAqua,
        NSWindow,
    };

    let ns_window = window.ns_window().map_err(|error| error.to_string())?;
    let ns_window: &NSWindow = unsafe { &*ns_window.cast() };

    if theme == "system" {
        ns_window.setAppearance(None);
        return Ok(());
    }

    let appearance_name = unsafe {
        if theme == "light" {
            NSAppearanceNameAqua
        } else {
            NSAppearanceNameDarkAqua
        }
    };
    let appearance =
        NSAppearance::appearanceNamed(appearance_name).ok_or("NSAppearance missing")?;
    ns_window.setAppearance(Some(&appearance));
    Ok(())
}

pub(crate) fn apply_window_appearance(window: &Window, theme: &str) -> Result<(), String> {
    #[cfg(test)]
    if let Some(handler) = WINDOW_APPEARANCE_OVERRIDE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap()
        .as_ref()
    {
        return handler(window, theme);
    }

    let next_theme = match theme {
        "light" => Some(Theme::Light),
        "dark" | "dim" => Some(Theme::Dark),
        _ => None,
    };
    let _ = window.set_theme(next_theme);

    #[cfg(target_os = "macos")]
    {
        let window_handle = window.clone();
        let theme_value = theme.to_string();
        window
            .run_on_main_thread(move || {
                let _ = apply_macos_window_appearance(&window_handle, theme_value.as_str());
            })
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn clamp_window_opacity(opacity: f64) -> Result<f64, String> {
    if !opacity.is_finite() {
        return Err("invalid window opacity: value must be finite".to_string());
    }
    Ok(opacity.clamp(WINDOW_OPACITY_MIN, WINDOW_OPACITY_MAX))
}

fn opacity_result(
    requested_opacity: f64,
    applied_opacity: f64,
    applied: bool,
    platform: &'static str,
    reason: Option<String>,
) -> WindowOpacityApplyResult {
    WindowOpacityApplyResult {
        requested_opacity,
        applied_opacity,
        applied,
        platform,
        reason,
    }
}

#[cfg(target_os = "macos")]
fn apply_native_window_opacity(
    window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    use objc2_app_kit::NSWindow;

    let applied_opacity = clamp_window_opacity(opacity)?;
    let ns_window = window
        .ns_window()
        .map_err(|error| format!("failed to get macOS window handle: {error}"))?
        as usize;
    window
        .run_on_main_thread(move || {
            let ns_window = ns_window as *mut std::ffi::c_void;
            let ns_window: &NSWindow = unsafe { &*ns_window.cast() };
            ns_window.setAlphaValue(applied_opacity);
        })
        .map_err(|error| format!("failed to apply macOS window opacity: {error}"))?;

    Ok(opacity_result(
        opacity,
        applied_opacity,
        true,
        "macos",
        None,
    ))
}

#[cfg(target_os = "windows")]
fn apply_native_window_opacity(
    window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, LWA_ALPHA,
        WS_EX_LAYERED,
    };

    let applied_opacity = clamp_window_opacity(opacity)?;
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("failed to get Windows window handle: {error}"))?;
    let hwnd = hwnd.0 as windows_sys::Win32::Foundation::HWND;
    let alpha = (applied_opacity * 255.0).round() as u8;

    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED as isize);
        if SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA) == 0 {
            return Err(format!(
                "failed to apply Windows window opacity: GetLastError={}",
                GetLastError()
            ));
        }
    }

    Ok(opacity_result(
        opacity,
        applied_opacity,
        true,
        "windows",
        None,
    ))
}

#[cfg(target_os = "linux")]
fn apply_native_window_opacity(
    _window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    let applied_opacity = clamp_window_opacity(opacity)?;
    Ok(opacity_result(
        opacity,
        applied_opacity,
        false,
        "linux",
        Some("native window opacity is not supported on this Linux runtime".to_string()),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn apply_native_window_opacity(
    _window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    let applied_opacity = clamp_window_opacity(opacity)?;
    Ok(opacity_result(
        opacity,
        applied_opacity,
        false,
        "unsupported",
        Some("native window opacity is not supported on this platform".to_string()),
    ))
}

#[tauri::command]
pub(crate) fn set_main_window_opacity(
    window: Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    apply_native_window_opacity(&window, opacity)
}

#[cfg(test)]
mod tests {
    use super::clamp_window_opacity;

    #[test]
    fn clamps_window_opacity_to_readable_range() {
        assert_eq!(clamp_window_opacity(0.2).unwrap(), 0.55);
        assert_eq!(clamp_window_opacity(0.88).unwrap(), 0.88);
        assert_eq!(clamp_window_opacity(1.4).unwrap(), 1.0);
    }

    #[test]
    fn rejects_non_finite_window_opacity() {
        assert!(clamp_window_opacity(f64::NAN).is_err());
        assert!(clamp_window_opacity(f64::INFINITY).is_err());
    }
}

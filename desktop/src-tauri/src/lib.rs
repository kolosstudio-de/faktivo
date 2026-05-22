use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::process::Command;

// ─── Machine fingerprint ───────────────────────────────────────────────────
//
// Wir bilden einen SHA256-Hash aus board-serial + cpu-brand. Beides ist
// nicht reversibel auf personenbezogene Daten — der Hash dient nur, die
// gleiche Hardware wiederzuerkennen, wenn der User die App neu installiert
// oder das Betriebssystem neu aufsetzt.

#[tauri::command]
fn machine_fingerprint() -> Result<String, String> {
    let board_serial = read_board_serial().unwrap_or_default();
    let cpu_brand = read_cpu_brand().unwrap_or_default();
    let combined = format!("{board_serial}|{cpu_brand}");
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

#[cfg(target_os = "macos")]
fn read_board_serial() -> Option<String> {
    let output = Command::new("ioreg")
        .args(["-l", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.contains("IOPlatformSerialNumber") {
            // line format: "IOPlatformSerialNumber" = "ABCDEFG12345"
            if let Some(eq) = line.find('=') {
                let val = line[eq + 1..].trim().trim_matches('"').trim();
                return Some(val.to_string());
            }
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn read_board_serial() -> Option<String> {
    None
}

#[cfg(target_os = "macos")]
fn read_cpu_brand() -> Option<String> {
    let output = Command::new("sysctl")
        .args(["-n", "machdep.cpu.brand_string"])
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(not(target_os = "macos"))]
fn read_cpu_brand() -> Option<String> {
    None
}

// ─── App info ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct AppInfo {
    version: String,
    os: String,
    arch: String,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

// ─── Open external URL (für Stripe-Checkout / FAQ) ────────────────────────

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    // Whitelist: nur HTTPS-URLs zu unserem Cloud-Server + Stripe.
    if !url.starts_with("https://") {
        return Err("Only HTTPS URLs allowed".into());
    }
    let allowed_hosts = [
        "faktivo.de",
        "app.faktivo.de",
        "checkout.stripe.com",
        "billing.stripe.com",
        "dashboard.stripe.com",
    ];
    let parsed = url.split('/').collect::<Vec<_>>();
    if parsed.len() < 3 {
        return Err("Invalid URL".into());
    }
    let host = parsed[2];
    let allowed = allowed_hosts.iter().any(|h| host == *h || host.ends_with(&format!(".{h}")));
    if !allowed {
        return Err(format!("Host {host} not whitelisted"));
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Setup ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            machine_fingerprint,
            app_info,
            open_external,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

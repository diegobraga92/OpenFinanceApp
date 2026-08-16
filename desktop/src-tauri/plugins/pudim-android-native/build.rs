const COMMANDS: &[&str] = &[
    "is_supported",
    "access_granted",
    "open_settings",
    "drain_pending",
    "secure_get",
    "secure_set",
    "secure_delete",
    "biometric_available",
    "biometric_authenticate",
    "set_widget_spent_today",
    "take_deep_link",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}

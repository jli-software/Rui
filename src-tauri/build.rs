fn main() {
    // tauri-build meldet cargo nur tauri.conf.json und die Capabilities als
    // Abhängigkeit. Ändert sich bloss eine Datei in icons/, liefe der
    // Build-Script nicht neu — die bereits kompilierte Windows-Ressource
    // bliebe mit dem alten Bild liegen und die EXE trüge weiter das
    // vorherige Icon.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}

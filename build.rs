use std::path::Path;
use std::process::Command;
use std::time::SystemTime;

fn main() {
    let dashboard_dir = Path::new("dashboard");
    if !dashboard_dir.exists() {
        return;
    }

    // No rerun-if-changed directives → cargo re-runs this script on every build.
    // any_source_newer() quickly skips the actual npm build when nothing changed.
    // Directory-level rerun-if-changed doesn't detect file content changes on Windows.

    let dist_index = dashboard_dir.join("dist").join("index.html");
    if dist_index.exists() && !any_source_newer(&dashboard_dir, &dist_index) {
        return;
    }

    println!("cargo:warning=Building dashboard frontend...");

    let npm = if cfg!(windows) { "npm.cmd" } else { "npm" };

    let status = Command::new(npm)
        .arg("install")
        .arg("--prefer-offline")
        .current_dir(&dashboard_dir)
        .status()
        .expect("Failed to run npm install");
    assert!(status.success(), "npm install failed");

    let status = Command::new(npm)
        .args(["run", "build"])
        .current_dir(&dashboard_dir)
        .status()
        .expect("Failed to run npm run build");
    assert!(status.success(), "npm run build failed");

    println!("cargo:warning=Dashboard build complete");
}

fn any_source_newer(dashboard_dir: &Path, dist_index: &Path) -> bool {
    let dist_time = match std::fs::metadata(dist_index).and_then(|m| m.modified()) {
        Ok(t) => t,
        Err(_) => return true,
    };
    src_dir_newer(&dashboard_dir.join("src"), dist_time)
        || file_newer(&dashboard_dir.join("index.html"), dist_time)
        || file_newer(&dashboard_dir.join("vite.config.js"), dist_time)
        || file_newer(&dashboard_dir.join("package.json"), dist_time)
}

fn src_dir_newer(dir: &Path, ref_time: SystemTime) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return true;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && src_dir_newer(&path, ref_time) {
            return true;
        }
        if file_newer(&path, ref_time) {
            return true;
        }
    }
    false
}

fn file_newer(path: &Path, ref_time: SystemTime) -> bool {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .map_or(true, |t| t > ref_time)
}

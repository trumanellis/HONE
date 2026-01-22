use std::fs;
use std::path::Path;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};

const MAX_RECENT_FILES: usize = 10;
const RECENT_FILES_FILENAME: &str = "recent_files.json";
const SESSION_FILENAME: &str = "session.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub accessed_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct RecentFilesData {
    files: Vec<RecentFile>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct SessionData {
    pub open_files: Vec<String>,
    pub active_file: Option<String>,
}

fn get_recent_files_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create directory if it doesn't exist
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    Ok(app_data_dir.join(RECENT_FILES_FILENAME))
}

fn load_recent_files_data(app: &AppHandle) -> Result<RecentFilesData, String> {
    let path = get_recent_files_path(app)?;

    if !path.exists() {
        return Ok(RecentFilesData::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent files: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recent files: {}", e))
}

fn save_recent_files_data(app: &AppHandle, data: &RecentFilesData) -> Result<(), String> {
    let path = get_recent_files_path(app)?;

    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize recent files: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write recent files: {}", e))
}

fn get_session_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create directory if it doesn't exist
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    Ok(app_data_dir.join(SESSION_FILENAME))
}

fn load_session_data(app: &AppHandle) -> Result<SessionData, String> {
    let path = get_session_path(app)?;

    if !path.exists() {
        return Ok(SessionData::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read session: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse session: {}", e))
}

fn save_session_data(app: &AppHandle, data: &SessionData) -> Result<(), String> {
    let path = get_session_path(app)?;

    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write session: {}", e))
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn get_file_dir(path: String) -> Result<String, String> {
    Path::new(&path)
        .parent()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to get directory".to_string())
}

#[tauri::command]
fn get_recent_files(app: AppHandle) -> Result<Vec<RecentFile>, String> {
    let mut data = load_recent_files_data(&app)?;

    // Filter out files that no longer exist
    let original_len = data.files.len();
    data.files.retain(|f| Path::new(&f.path).exists());

    // Save back if any files were removed
    if data.files.len() != original_len {
        save_recent_files_data(&app, &data)?;
    }

    Ok(data.files)
}

#[tauri::command]
fn add_recent_file(app: AppHandle, path: String) -> Result<(), String> {
    // Verify the file exists
    if !Path::new(&path).exists() {
        return Err("File does not exist".to_string());
    }

    let mut data = load_recent_files_data(&app)?;

    // Extract filename from path
    let name = Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&path)
        .to_string();

    // Get current timestamp
    let accessed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Remove existing entry for this path if present
    data.files.retain(|f| f.path != path);

    // Add new entry at the beginning
    data.files.insert(0, RecentFile {
        path,
        name,
        accessed_at,
    });

    // Limit to MAX_RECENT_FILES
    data.files.truncate(MAX_RECENT_FILES);

    save_recent_files_data(&app, &data)
}

#[tauri::command]
fn get_session(app: AppHandle) -> Result<SessionData, String> {
    let mut data = load_session_data(&app)?;

    // Filter out files that no longer exist
    let original_len = data.open_files.len();
    data.open_files.retain(|p| Path::new(p).exists());

    // Clear active file if it no longer exists
    if let Some(ref active) = data.active_file {
        if !Path::new(active).exists() {
            data.active_file = None;
        }
    }

    // Save back if any files were removed
    if data.open_files.len() != original_len {
        let _ = save_session_data(&app, &data);
    }

    Ok(data)
}

#[tauri::command]
fn save_session(app: AppHandle, open_files: Vec<String>, active_file: Option<String>) -> Result<(), String> {
    let data = SessionData {
        open_files,
        active_file,
    };
    save_session_data(&app, &data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Create menu items with keyboard shortcuts
            let open = MenuItemBuilder::with_id("open", "Open")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let save = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;

            // App menu (macOS)
            let app_menu = SubmenuBuilder::new(app, "HONE")
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&open)
                .item(&save)
                .item(&save_as)
                .separator()
                .close_window()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app, event| {
                match event.id().as_ref() {
                    "open" => {
                        let _ = app.emit("menu-open", ());
                    }
                    "save" => {
                        let _ = app.emit("menu-save", ());
                    }
                    "save_as" => {
                        let _ = app.emit("menu-save-as", ());
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, write_file, get_file_dir, get_recent_files, add_recent_file, get_session, save_session])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

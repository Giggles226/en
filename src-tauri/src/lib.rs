use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::State;

struct OllamaProcess(Mutex<Option<Child>>);

#[tauri::command]
fn start_ollama(state: State<OllamaProcess>) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok("Ollama is already running".to_string());
    }
    let child = Command::new("ollama")
        .arg("serve")
        .spawn()
        .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    *guard = Some(child);
    Ok("Ollama started".to_string())
}

#[tauri::command]
fn stop_ollama(state: State<OllamaProcess>) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| format!("Failed to stop Ollama: {}", e))?;
        child.wait().ok();
        Ok("Ollama stopped".to_string())
    } else {
        Ok("Ollama was not running".to_string())
    }
}

#[tauri::command]
fn check_ollama_status(state: State<OllamaProcess>) -> String {
    let guard = state.0.lock().ok();
    match guard {
        Some(g) if g.is_some() => "running".to_string(),
        _ => "stopped".to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(OllamaProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_ollama,
            stop_ollama,
            check_ollama_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
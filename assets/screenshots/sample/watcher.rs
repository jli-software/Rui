use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};

/// A theme change writes several files in quick succession, so the raw
/// events are collapsed into one notification after a quiet period.
const DEBOUNCE: Duration = Duration::from_millis(300);

pub struct ThemeWatcher {
    root: PathBuf,
}

impl ThemeWatcher {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn watch<F>(&self, mut on_change: F) -> notify::Result<()>
    where
        F: FnMut() + Send + 'static,
    {
        let (tx, rx) = channel();
        let mut watcher = notify::recommended_watcher(tx)?;
        watcher.watch(&self.root, RecursiveMode::NonRecursive)?;

        std::thread::spawn(move || {
            while rx.recv().is_ok() {
                // Drain whatever else arrives inside the quiet period.
                while rx.recv_timeout(DEBOUNCE).is_ok() {}
                on_change();
            }
        });

        Ok(())
    }
}

use std::fs;
use std::path::PathBuf;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::Layer;
use tracing_subscriber::fmt::time::ChronoLocal;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Initializes the tracing logger with file output (rolling daily) and console output.
///
/// Returns `WorkerGuard`s that must be kept alive for the lifetime of the application.
pub fn init_logger(log_dir: Option<PathBuf>) -> Vec<WorkerGuard> {
    let dir = log_dir.unwrap_or_else(|| PathBuf::from("logs"));
    if let Err(e) = fs::create_dir_all(&dir) {
        eprintln!(
            "[Logger] WARNING: Could not create logs directory {dir:?}: {e}. Logging to console only."
        );
        let (console_writer, console_guard) = tracing_appender::non_blocking(std::io::stdout());
        let console_timer = ChronoLocal::new("%Y-%m-%d %H:%M:%S".to_string());
        let filter = tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
        tracing_subscriber::Registry::default()
            .with(filter)
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(console_writer)
                    .with_ansi(true)
                    .with_target(false)
                    .with_timer(console_timer)
                    .with_level(true)
                    .boxed(),
            )
            .init();
        return vec![console_guard];
    }

    let file_appender = tracing_appender::rolling::daily(&dir, "pdms-omni.log");
    let (file_writer, file_guard) = tracing_appender::non_blocking(file_appender);

    let (console_writer, console_guard) = tracing_appender::non_blocking(std::io::stdout());

    let file_timer = ChronoLocal::new("%Y-%m-%d %H:%M:%S%.3f".to_string());
    let console_timer = ChronoLocal::new("%Y-%m-%d %H:%M:%S".to_string());

    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(file_writer)
        .with_ansi(false)
        .with_target(false)
        .with_timer(file_timer)
        .with_level(true)
        .boxed();

    let console_layer = tracing_subscriber::fmt::layer()
        .with_writer(console_writer)
        .with_ansi(true)
        .with_target(false)
        .with_timer(console_timer)
        .with_level(true)
        .boxed();

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::Registry::default()
        .with(filter)
        .with(console_layer)
        .with(file_layer)
        .init();

    vec![file_guard, console_guard]
}

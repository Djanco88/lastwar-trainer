//! lastwar-core: eigenständiger RTS-Simulationskern (Rust).
//! Keine externen Assets/Inhalte anderer Spiele. Port der JS-Engine (src/core.js).
//! Einsatz: WASM fürs Browser-Spiel oder nativ mit wgpu (Vulkan) als Desktop-Build.

pub mod cfg;
pub mod map;
pub mod state;
pub mod tick;

pub use cfg::*;
pub use map::Map;
pub use state::*;

#[cfg(test)]
mod tests;

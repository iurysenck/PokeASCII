#pragma once

#include <cstdint>
#include <cstddef>
#include <cmath>

namespace pokemon_ar {

using u8  = std::uint8_t;
using u16 = std::uint16_t;
using u32 = std::uint32_t;
using u64 = std::uint64_t;

using i8  = std::int8_t;
using i16 = std::int16_t;
using i32 = std::int32_t;
using i64 = std::int64_t;

using f32 = float;
using f64 = double;

inline constexpr f32 kPi      = 3.14159265358979323846f;
inline constexpr f32 kTwoPi   = 6.28318530717958647692f;
inline constexpr f32 kHalfPi  = 1.57079632679489661923f;
inline constexpr f32 kEpsilon = 1e-6f;

[[nodiscard]] constexpr f32 deg_to_rad(f32 degrees) noexcept {
    return degrees * (kPi / 180.0f);
}

[[nodiscard]] constexpr f32 rad_to_deg(f32 radians) noexcept {
    return radians * (180.0f / kPi);
}

/// Descreve a geometria física e lógica da grade ASCII (Terminal ou Canvas Mobile) para correção de aspecto.
struct TerminalMetrics {
    u32 columns        = 120;
    u32 rows           = 40;
    f32 cell_width_px  = 9.0f;
    f32 cell_height_px = 18.0f;

    /// Razão de aspecto da célula individual (tipicamente ~0.5 em fontes monoespaçadas).
    [[nodiscard]] constexpr f32 cell_aspect() const noexcept {
        return (cell_height_px > 0.0f) ? (cell_width_px / cell_height_px) : 0.5f;
    }

    /// Razão de aspecto física real da janela de visualização.
    /// A_efetivo = (W_colunas / H_linhas) * (W_px_celula / H_px_celula)
    [[nodiscard]] constexpr f32 effective_aspect_ratio() const noexcept {
        if (rows == 0 || cell_height_px <= 0.0f) {
            return 1.0f;
        }
        return (static_cast<f32>(columns) / static_cast<f32>(rows)) * cell_aspect();
    }
};

} // namespace pokemon_ar

#pragma once

#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"
#include "pokemon_ar/renderer/gpu_renderer.hpp"
#include "pokemon_ar/tracker/ar_tracker.hpp"
#include "pokemon_ar/tty/tty_presenter.hpp"

#include <span>
#include <string_view>

namespace pokemon_ar::postproc {

/// Configuração do quantizador ASCII 3D com fusão de Câmera de Realidade Aumentada.
struct PostProcConfig {
    tty::RenderMode  mode                  = tty::RenderMode::Ascii3D;
    f32              edge_threshold_3d     = 0.32f;  ///< Limiar Sobel 3D para silhueta e vincos dos Pokémons
    f32              edge_threshold_camera = 0.28f;  ///< Limiar Sobel 2D para desenhar contornos do mundo real da câmera
    f32              camera_fg_dim         = 0.72f;  ///< Atenuação do FG da câmera real para destacar os Pokémons 3D
    f32              camera_bg_dim         = 0.28f;  ///< Atenuação do BG da câmera real
    f32              entity_bg_fill        = 0.46f;  ///< Preenchimento sólido de BG no interior dos Pokémons 3D
    bool             show_ar_feature_dots  = true;   ///< Exibe marcadores '+' verdes nos pontos do ambiente ancorados pelo KLT
    std::string_view luminance_ramp        = " .:-=+*#%@";
};

[[nodiscard]] constexpr f32 compute_luminance(const math::Vec3& rgb) noexcept {
    return 0.2126f * rgb.x + 0.7152f * rgb.y + 0.0722f * rgb.z;
}

[[nodiscard]] char select_luminance_glyph(f32 luminance, std::string_view ramp = " .:-=+*#%@") noexcept;
[[nodiscard]] char select_directional_edge_glyph(f32 gx, f32 gy) noexcept;

/// Processador que funde o Frame da Câmera Real (já com Sobel KLT) e o G-Buffer 3D dos Pokémons no FrameBufferTTY.
class AsciiPostProcessor {
public:
    explicit AsciiPostProcessor(const PostProcConfig& cfg = {});

    void set_config(const PostProcConfig& cfg) noexcept { config_ = cfg; }
    [[nodiscard]] const PostProcConfig& config() const noexcept { return config_; }

    static void required_gbuffer_size(u32 tty_cols, u32 tty_rows,
                                      tty::RenderMode mode,
                                      u32& out_gb_width, u32& out_gb_height) noexcept;

    /// Funde o ambiente da câmera real (`camera_frame`) com as entidades 3D (`gbuffer`) em uma única passagem.
    void process_ar_frame(const renderer::GBuffer& gbuffer,
                          const tracker::CameraFrameBuffer& camera_frame,
                          std::span<const tracker::TrackedFeaturePoint> klt_points,
                          tty::FrameBufferTTY& out_tty,
                          f32 z_near,
                          f32 z_far) const;

private:
    PostProcConfig config_{};
};

} // namespace pokemon_ar::postproc

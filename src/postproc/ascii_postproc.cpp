#include "pokemon_ar/postproc/ascii_postproc.hpp"

#include <algorithm>
#include <cmath>

namespace pokemon_ar::postproc {

char select_luminance_glyph(f32 luminance, std::string_view ramp) noexcept {
    if (ramp.empty()) {
        return '#';
    }
    const f32 clamped = std::clamp(luminance, 0.0f, 1.0f);
    const std::size_t max_idx = ramp.size() - 1;
    const std::size_t idx = static_cast<std::size_t>(std::lround(clamped * static_cast<f32>(max_idx)));
    return ramp[std::min(idx, max_idx)];
}

char select_directional_edge_glyph(f32 gx, f32 gy) noexcept {
    const f32 ax = std::fabs(gx);
    const f32 ay = std::fabs(gy);

    if (ax > ay * 2.0f) {
        return '|';
    }
    if (ay > ax * 2.0f) {
        return '-';
    }
    return (gx * gy >= 0.0f) ? '/' : '\\';
}

AsciiPostProcessor::AsciiPostProcessor(const PostProcConfig& cfg)
    : config_(cfg) {}

void AsciiPostProcessor::required_gbuffer_size(u32 tty_cols, u32 tty_rows,
                                               tty::RenderMode mode,
                                               u32& out_gb_width, u32& out_gb_height) noexcept {
    switch (mode) {
        case tty::RenderMode::HalfBlock:
            out_gb_width  = tty_cols;
            out_gb_height = tty_rows * 2;
            break;
        case tty::RenderMode::Braille:
            out_gb_width  = tty_cols * 2;
            out_gb_height = tty_rows * 4;
            break;
        case tty::RenderMode::Ascii3D:
        default:
            out_gb_width  = tty_cols;
            out_gb_height = tty_rows;
            break;
    }
}

namespace {

[[nodiscard]] tty::ColorRGB vec3_to_rgb8(const math::Vec3& c) noexcept {
    const u8 r = static_cast<u8>(std::clamp(c.x * 255.0f, 0.0f, 255.0f));
    const u8 g = static_cast<u8>(std::clamp(c.y * 255.0f, 0.0f, 255.0f));
    const u8 b = static_cast<u8>(std::clamp(c.z * 255.0f, 0.0f, 255.0f));
    return {r, g, b};
}

[[nodiscard]] const tracker::CameraCellFeature& sample_camera_cell(const tracker::CameraFrameBuffer& cam,
                                                                   u32 col, u32 row,
                                                                   u32 total_cols, u32 total_rows) noexcept {
    static const tracker::CameraCellFeature kFallbackCell{};
    if (cam.width() == 0 || cam.height() == 0 || total_cols == 0 || total_rows == 0) {
        return kFallbackCell;
    }
    const u32 cx = std::min(cam.width() - 1, (col * cam.width()) / total_cols);
    const u32 cy = std::min(cam.height() - 1, (row * cam.height()) / total_rows);
    return cam.at(cx, cy);
}

[[nodiscard]] f32 structural_field_3d(const renderer::GBuffer& gb, i32 x, i32 y, f32 z_far) noexcept {
    const i32 cx = std::clamp<i32>(x, 0, static_cast<i32>(gb.width()) - 1);
    const i32 cy = std::clamp<i32>(y, 0, static_cast<i32>(gb.height()) - 1);
    const renderer::GBufferPixel& px = gb.at(static_cast<u32>(cx), static_cast<u32>(cy));
    if (px.entity_id == 0) {
        return 0.0f;
    }
    const f32 proximity = 1.0f - std::clamp(px.linear_depth / z_far, 0.0f, 0.85f);
    return proximity + 0.18f * px.view_normal.x + 0.18f * px.view_normal.y;
}

} // namespace

void AsciiPostProcessor::process_ar_frame(const renderer::GBuffer& gbuffer,
                                          const tracker::CameraFrameBuffer& camera_frame,
                                          std::span<const tracker::TrackedFeaturePoint> klt_points,
                                          tty::FrameBufferTTY& out_tty,
                                          f32 z_near,
                                          f32 z_far) const {
    (void)z_near;
    const u32 cols = out_tty.columns();
    const u32 rows = out_tty.rows();
    const u32 gb_w = gbuffer.width();
    const u32 gb_h = gbuffer.height();

    if (cols == 0 || rows == 0 || gb_w == 0 || gb_h == 0) {
        return;
    }

    // Modo 2: Half-Block ('▀') - Dobra a resolução vertical fundindo câmera real + entidades 3D
    if (config_.mode == tty::RenderMode::HalfBlock && gb_w == cols && gb_h == rows * 2) {
        for (u32 r = 0; r < rows; ++r) {
            for (u32 c = 0; c < cols; ++c) {
                const tracker::CameraCellFeature& cam_top = sample_camera_cell(camera_frame, c, r * 2, cols, rows * 2);
                const tracker::CameraCellFeature& cam_bot = sample_camera_cell(camera_frame, c, r * 2 + 1, cols, rows * 2);

                const renderer::GBufferPixel& p_top = gbuffer.at(c, r * 2);
                const renderer::GBufferPixel& p_bot = gbuffer.at(c, r * 2 + 1);

                const math::Vec3 c_top = (p_top.entity_id != 0) ? p_top.albedo : (cam_top.rgb * config_.camera_fg_dim);
                const math::Vec3 c_bot = (p_bot.entity_id != 0) ? p_bot.albedo : (cam_bot.rgb * config_.camera_fg_dim);

                out_tty.set_half_block(c, r, vec3_to_rgb8(c_top), vec3_to_rgb8(c_bot));
            }
        }
        return;
    }

    // Modo 3: Braille Unicode (2x4 sub-pixels por célula = 8x densidade!)
    if (config_.mode == tty::RenderMode::Braille && gb_w == cols * 2 && gb_h == rows * 4) {
        static constexpr u8 kBrailleBit[4][2] = {
            {0x01, 0x08},
            {0x02, 0x10},
            {0x04, 0x20},
            {0x40, 0x80}
        };

        for (u32 r = 0; r < rows; ++r) {
            for (u32 c = 0; c < cols; ++c) {
                const tracker::CameraCellFeature& cam_cell = sample_camera_cell(camera_frame, c, r, cols, rows);
                const math::Vec3 cam_bg = cam_cell.rgb * config_.camera_bg_dim;

                u8 mask_3d = 0;
                math::Vec3 fg_accum_3d{0.0f, 0.0f, 0.0f};
                u32 lit_3d = 0;

                for (u32 sy = 0; sy < 4; ++sy) {
                    for (u32 sx = 0; sx < 2; ++sx) {
                        const renderer::GBufferPixel& sp = gbuffer.at(c * 2 + sx, r * 4 + sy);
                        if (sp.entity_id != 0) {
                            mask_3d |= kBrailleBit[sy][sx];
                            fg_accum_3d += sp.albedo;
                            ++lit_3d;
                        }
                    }
                }

                tty::Cell& cell = out_tty.at(c, r);
                cell.bg = vec3_to_rgb8(cam_bg);

                if (lit_3d > 0) {
                    const math::Vec3 avg_fg = fg_accum_3d / static_cast<f32>(lit_3d);
                    cell.codepoint = tty::FrameBufferTTY::braille_codepoint_from_mask(mask_3d);
                    cell.fg        = vec3_to_rgb8(avg_fg);
                    if (lit_3d >= 5) {
                        cell.bg = vec3_to_rgb8(avg_fg * config_.entity_bg_fill + cam_bg * (1.0f - config_.entity_bg_fill));
                    }
                } else {
                    // Mundo real da câmera em ASCII/Braille no fundo
                    if (cam_cell.grad_mag >= config_.edge_threshold_camera) {
                        cell.codepoint = static_cast<u32>(select_directional_edge_glyph(cam_cell.sobel_gx, cam_cell.sobel_gy));
                    } else {
                        cell.codepoint = static_cast<u32>(select_luminance_glyph(cam_cell.luminance, config_.luminance_ramp));
                    }
                    cell.fg = vec3_to_rgb8(cam_cell.rgb * config_.camera_fg_dim);
                }
            }
        }
        return;
    }

    // Modo 1 (Padrão): ASCII-3D (Fusão Mundo Real em ASCII Sobel 2D + Pokémons em ASCII 3D Sobel com silhueta destacada!)
    for (u32 r = 0; r < rows; ++r) {
        const u32 gy_idx = std::min(r, gb_h - 1);

        for (u32 c = 0; c < cols; ++c) {
            const u32 gx_idx = std::min(c, gb_w - 1);
            const tracker::CameraCellFeature& cam_cell = sample_camera_cell(camera_frame, c, r, cols, rows);
            const math::Vec3 cam_bg = cam_cell.rgb * config_.camera_bg_dim;

            const renderer::GBufferPixel& center = gbuffer.at(gx_idx, gy_idx);
            tty::Cell& out_cell = out_tty.at(c, r);

            if (center.entity_id == 0) {
                // Célula do Mundo Real da Câmera! Reaproveita os gradientes Sobel já calculados pelo rastreador KLT!
                out_cell.bg = vec3_to_rgb8(cam_bg);
                if (cam_cell.grad_mag >= config_.edge_threshold_camera) {
                    const char edge_ch = select_directional_edge_glyph(cam_cell.sobel_gx, cam_cell.sobel_gy);
                    out_cell.codepoint = static_cast<u32>(edge_ch);
                    out_cell.fg        = vec3_to_rgb8(cam_cell.rgb * std::min(1.0f, config_.camera_fg_dim * 1.18f));
                } else {
                    const char lum_ch = select_luminance_glyph(cam_cell.luminance, config_.luminance_ramp);
                    out_cell.codepoint = static_cast<u32>(lum_ch);
                    out_cell.fg        = vec3_to_rgb8(cam_cell.rgb * config_.camera_fg_dim);
                }
                continue;
            }

            // Célula de Pokémon 3D / Pokébola 3D / Anel de Ancoragem AR (entity_id > 0)
            const i32 ix = static_cast<i32>(gx_idx);
            const i32 iy = static_cast<i32>(gy_idx);

            const f32 s00 = structural_field_3d(gbuffer, ix - 1, iy - 1, z_far);
            const f32 s10 = structural_field_3d(gbuffer, ix,     iy - 1, z_far);
            const f32 s20 = structural_field_3d(gbuffer, ix + 1, iy - 1, z_far);

            const f32 s01 = structural_field_3d(gbuffer, ix - 1, iy,     z_far);
            const f32 s21 = structural_field_3d(gbuffer, ix + 1, iy,     z_far);

            const f32 s02 = structural_field_3d(gbuffer, ix - 1, iy + 1, z_far);
            const f32 s12 = structural_field_3d(gbuffer, ix,     iy + 1, z_far);
            const f32 s22 = structural_field_3d(gbuffer, ix + 1, iy + 1, z_far);

            const f32 gx = (s20 + 2.0f * s21 + s22) - (s00 + 2.0f * s01 + s02);
            const f32 gy = (s02 + 2.0f * s12 + s22) - (s00 + 2.0f * s10 + s20);
            const f32 grad_mag = std::sqrt(gx * gx + gy * gy);

            const u32 id_left  = gbuffer.at(static_cast<u32>(std::max(0, ix - 1)), gy_idx).entity_id;
            const u32 id_right = gbuffer.at(static_cast<u32>(std::min(static_cast<i32>(gb_w) - 1, ix + 1)), gy_idx).entity_id;
            const u32 id_up    = gbuffer.at(gx_idx, static_cast<u32>(std::max(0, iy - 1))).entity_id;
            const u32 id_down  = gbuffer.at(gx_idx, static_cast<u32>(std::min(static_cast<i32>(gb_h) - 1, iy + 1))).entity_id;

            const bool is_silhouette_boundary = (id_left != center.entity_id) ||
                                                (id_right != center.entity_id) ||
                                                (id_up != center.entity_id) ||
                                                (id_down != center.entity_id);

            // Preenchimento sólido de BG na superfície do Pokémon 3D para que ele se destaque sobre a câmera ASCII!
            const math::Vec3 surface_bg = center.albedo * config_.entity_bg_fill + cam_bg * (1.0f - config_.entity_bg_fill);
            out_cell.bg = vec3_to_rgb8(surface_bg);

            if ((is_silhouette_boundary && grad_mag > config_.edge_threshold_3d * 0.45f) ||
                grad_mag >= config_.edge_threshold_3d) {
                const char edge_ch = select_directional_edge_glyph(gx, gy);
                out_cell.codepoint = static_cast<u32>(edge_ch);
                const math::Vec3 edge_fg{
                    std::min(1.0f, center.albedo.x * 1.25f + 0.12f),
                    std::min(1.0f, center.albedo.y * 1.25f + 0.12f),
                    std::min(1.0f, center.albedo.z * 1.25f + 0.12f)
                };
                out_cell.fg = vec3_to_rgb8(edge_fg);
            } else {
                const f32 lum = compute_luminance(center.albedo);
                const char lum_ch = select_luminance_glyph(lum, config_.luminance_ramp);
                out_cell.codepoint = static_cast<u32>(lum_ch);
                out_cell.fg        = vec3_to_rgb8(center.albedo);
            }
        }
    }

    // Sobrepõe os marcadores '+' de ancoragem AR nos pontos do mundo real rastreados pelo KLT (somente no fundo)
    if (config_.show_ar_feature_dots && camera_frame.width() > 0 && camera_frame.height() > 0) {
        for (const tracker::TrackedFeaturePoint& pt : klt_points) {
            if (!pt.valid) {
                continue;
            }
            const u32 tc = std::min(cols - 1, static_cast<u32>((pt.x / static_cast<f32>(camera_frame.width())) * static_cast<f32>(cols)));
            const u32 tr = std::min(rows - 1, static_cast<u32>((pt.y / static_cast<f32>(camera_frame.height())) * static_cast<f32>(rows)));
            if (tr > 1 && tr + 1 < rows && gbuffer.at(std::min(tc, gb_w - 1), std::min(tr, gb_h - 1)).entity_id == 0) {
                tty::Cell& dot_cell = out_tty.at(tc, tr);
                dot_cell.codepoint  = U'+';
                dot_cell.fg         = {70, 255, 160};
            }
        }
    }
}

} // namespace pokemon_ar::postproc

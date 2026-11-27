#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"
#include "pokemon_ar/math/mat4.hpp"
#include "pokemon_ar/mesh/mesh.hpp"
#include "pokemon_ar/tracker/ar_tracker.hpp"
#include "pokemon_ar/renderer/gpu_renderer.hpp"
#include "pokemon_ar/postproc/ascii_postproc.hpp"
#include "pokemon_ar/game/ar_game.hpp"
#include "pokemon_ar/tty/tty_presenter.hpp"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string_view>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <conio.h>
#endif

using namespace pokemon_ar;

namespace {

const char* tier_label(tracker::TrackingTier tier) noexcept {
    switch (tier) {
        case tracker::TrackingTier::WebXR_SLAM_6DoF:               return "SLAM-6DoF";
        case tracker::TrackingTier::IMU_GyroGravity_Plus_SobelKLT: return "IMU+SobelKLT";
        case tracker::TrackingTier::Pure_Visual_SobelKLT:          return "SobelKLT-Visual";
        case tracker::TrackingTier::Manual_Fallback:               return "Manual";
        default:                                                   return "Auto";
    }
}

const char* quality_label(tracker::QualityProfile q) noexcept {
    switch (q) {
        case tracker::QualityProfile::Ultra_HighDensity: return "ULTRA";
        case tracker::QualityProfile::Balanced_Standard: return "BALANCED";
        case tracker::QualityProfile::Eco_UltraLight:    return "ECO-LIGHT";
        default:                                         return "AUTO";
    }
}

void write_hud_line(tty::FrameBufferTTY& fb, u32 row, std::string_view text, tty::ColorRGB fg, tty::ColorRGB bg) {
    if (row >= fb.rows()) {
        return;
    }
    const u32 cols = fb.columns();
    for (u32 c = 0; c < cols; ++c) {
        tty::Cell& cell = fb.at(c, row);
        cell.codepoint  = (c < text.size()) ? static_cast<u32>(static_cast<unsigned char>(text[c])) : U' ';
        cell.fg         = fg;
        cell.bg         = bg;
    }
}

void draw_ar_hud(tty::FrameBufferTTY& fb,
                 const tracker::ArPose6DoF& pose,
                 const game::ArGameSession& session,
                 tty::RenderMode mode,
                 f32 fps,
                 u32 tris) {
    const char* mode_str = (mode == tty::RenderMode::Ascii3D)   ? "1:ASCII-3D (Sobel)" :
                           (mode == tty::RenderMode::HalfBlock) ? "2:HalfBlock (2x)" :
                                                                  "3:Braille (8x)";

    f32 target_dist = 0.0f;
    f32 target_ang  = 0.0f;
    const i32 target_idx = session.find_targeted_pokemon(pose, target_dist, target_ang);
    const char* target_name = "NENHUM";
    u32 target_cp = 0;
    if (target_idx >= 0 && static_cast<std::size_t>(target_idx) < session.pokemons().size()) {
        const auto& p = session.pokemons()[static_cast<std::size_t>(target_idx)];
        target_name = game::species_name(p.species).data();
        target_cp   = p.combat_power;
    }

    char top_bar[256];
    const int top_len = std::snprintf(
        top_bar, sizeof(top_bar),
        " [POKEMON GO ASCII-3D AR] Track: %s (%u pts | Gov:%s) | Mira: %s (CP %u a %.1fm) | Pokedex: %u | %.0f FPS (%u Tris) | %s",
        tier_label(pose.active_tier),
        pose.tracked_anchors,
        quality_label(pose.active_quality),
        target_name,
        target_cp,
        target_dist,
        session.total_captured(),
        fps,
        tris,
        mode_str);
    if (top_len > 0) {
        write_hud_line(fb, 0, std::string_view(top_bar, static_cast<std::size_t>(top_len)), {240, 255, 245}, {14, 42, 32});
    }

    // Mira central AR (retículo '[ + ]' no centro da câmera quando apontando para um Pokémon)
    const u32 cx = fb.columns() / 2;
    const u32 cy = fb.rows() / 2;
    if (cx > 4 && cy > 2 && cy + 2 < fb.rows()) {
        const bool locked = (target_ang < 0.28f);
        const tty::ColorRGB reticle_col = locked ? tty::ColorRGB{80, 255, 120} : tty::ColorRGB{255, 220, 90};
        fb.at(cx - 2, cy).codepoint = U'['; fb.at(cx - 2, cy).fg = reticle_col;
        fb.at(cx + 2, cy).codepoint = U']'; fb.at(cx + 2, cy).fg = reticle_col;
    }

    // Barra inferior de status e controles
    if (fb.rows() >= 2) {
        char bot_bar[256];
        const int bot_len = std::snprintf(
            bot_bar, sizeof(bot_bar),
            " %s | [ESPACO] Lancar Pokebola [A/D/W/S] Mover Camera [1/2/3] Modo [R] Recalibrar [Q] Sair",
            session.status_banner().data());
        if (bot_len > 0) {
            write_hud_line(fb, fb.rows() - 1, std::string_view(bot_bar, static_cast<std::size_t>(bot_len)), {255, 245, 200}, {38, 22, 16});
        }
    }
}

} // namespace

int main(int argc, char** argv) {
    bool snapshot_only = false;
    u32 max_frames = 0;

    for (int i = 1; i < argc; ++i) {
        const std::string_view arg(argv[i]);
        if (arg == "--snapshot") {
            snapshot_only = true;
            max_frames = 1;
        } else if (arg == "--demo-short") {
            max_frames = 180;
        }
    }

    tty::TerminalDevice tty_dev;
    TerminalMetrics metrics{130, 38, 9.0f, 18.0f};
    if (!snapshot_only) {
        tty_dev.initialize(140, 42);
        metrics = tty_dev.query_metrics();
    }

    // Inicializa Rastreador 3D Adaptativo (Sensor Fusion + Sobel KLT + Governador de Estabilidade)
    tracker::AdaptiveArTracker ar_tracker;
    tracker::DeviceCapabilities caps{};
    caps.has_camera_stream    = true;
    caps.has_gyroscope        = true;
    caps.has_accelerometer    = true;
    caps.cpu_logical_cores    = std::max(2u, std::thread::hardware_concurrency());

    postproc::PostProcConfig pp_cfg{};
    pp_cfg.mode = tty::RenderMode::Ascii3D;
    postproc::AsciiPostProcessor post_processor(pp_cfg);

    u32 gb_w = 0, gb_h = 0;
    postproc::AsciiPostProcessor::required_gbuffer_size(metrics.columns, metrics.rows, pp_cfg.mode, gb_w, gb_h);

    renderer::GpuRenderer gpu;
    gpu.initialize(gb_w, gb_h);
    caps.has_gpu_acceleration = gpu.device_info().vulkan_headless_active;
    ar_tracker.configure_hardware(caps);

    // Inicializa Sessão de Jogo Pokémon AR (Pokémons 3D + Pokébola 3D)
    game::ArGameSession session;

    tracker::CameraFrameBuffer camera_frame(metrics.columns, metrics.rows);
    tty::FrameBufferTTY tty_fb(metrics.columns, metrics.rows);
    tty::AnsiSerializer serializer(1);

    // Pose física simulada do celular/câmera no ambiente (alimenta a câmera sintética e o rastreador KLT)
    math::Vec3 physical_cam_pos{0.0f, 0.0f, 0.0f};
    f32 physical_yaw   = 0.0f;
    f32 physical_pitch = 0.05f;
    f32 fps_ema        = 60.0f;

    if (snapshot_only) {
        // No modo snapshot, arremessa uma Pokébola para mostrar tanto o Pikachu 3D quanto a Pokébola 3D em voo!
        session.throw_pokeball(ar_tracker.pose(), 6.8f, 0.28f, 0.0f);
    }

    const auto start_clock = std::chrono::steady_clock::now();
    auto prev_clock        = start_clock;
    u32 frame_idx          = 0;
    bool running           = true;

    std::vector<renderer::DrawCommand> draw_cmds;
    draw_cmds.reserve(16);

    while (running) {
        const auto now_clock = std::chrono::steady_clock::now();
        const f32 dt = snapshot_only ? 0.16f : std::max(0.001f, std::chrono::duration<f32>(now_clock - prev_clock).count());
        prev_clock = now_clock;
        if (dt > 1e-5f) {
            fps_ema = fps_ema * 0.9f + (1.0f / dt) * 0.1f;
        }

        const f32 t = snapshot_only ? 0.45f : std::chrono::duration<f32>(now_clock - start_clock).count();

#ifdef _WIN32
        if (!snapshot_only) {
            while (_kbhit()) {
                const int ch = _getch();
                if (ch == 'q' || ch == 'Q' || ch == 27) {
                    running = false;
                } else if (ch == ' ') {
                    session.throw_pokeball(ar_tracker.pose());
                } else if (ch == 'r' || ch == 'R') {
                    physical_cam_pos = {0.0f, 0.0f, 0.0f};
                    physical_yaw     = 0.0f;
                    physical_pitch   = 0.05f;
                    ar_tracker.reset_world_anchor();
                } else if (ch == '1') {
                    pp_cfg.mode = tty::RenderMode::Ascii3D;
                    post_processor.set_config(pp_cfg);
                } else if (ch == '2') {
                    pp_cfg.mode = tty::RenderMode::HalfBlock;
                    post_processor.set_config(pp_cfg);
                } else if (ch == '3') {
                    pp_cfg.mode = tty::RenderMode::Braille;
                    post_processor.set_config(pp_cfg);
                } else if (ch == 'a' || ch == 'A') {
                    physical_yaw -= 0.10f;
                } else if (ch == 'd' || ch == 'D') {
                    physical_yaw += 0.10f;
                } else if (ch == 'w' || ch == 'W') {
                    physical_cam_pos.x += std::sin(physical_yaw) * 0.25f;
                    physical_cam_pos.z += -std::cos(physical_yaw) * 0.25f;
                } else if (ch == 's' || ch == 'S') {
                    physical_cam_pos.x -= std::sin(physical_yaw) * 0.25f;
                    physical_cam_pos.z -= -std::cos(physical_yaw) * 0.25f;
                }
            }
        }
#endif

        if (!snapshot_only) {
            metrics = tty_dev.query_metrics();
            if (tty_fb.columns() != metrics.columns || tty_fb.rows() != metrics.rows) {
                tty_fb.resize(metrics.columns, metrics.rows);
            }
        }

        // Adapta tolerância ANSI e densidade de acordo com o Governador de Estabilidade do dispositivo
        const auto active_qual = ar_tracker.pose().active_quality;
        serializer.set_color_tolerance((active_qual == tracker::QualityProfile::Eco_UltraLight) ? 3 : 1);

        postproc::AsciiPostProcessor::required_gbuffer_size(metrics.columns, metrics.rows, pp_cfg.mode, gb_w, gb_h);
        gpu.resize(gb_w, gb_h);
        camera_frame.resize(metrics.columns, metrics.rows);

        // 1. Captura frame da câmera do ambiente e calcula Sobel 2D + cantos de Harris em passagem única
        camera_frame.render_synthetic_environment(physical_cam_pos, physical_yaw, physical_pitch, t);

        // 2. Alimenta o Rastreador 3D Adaptativo (Fusão IMU + Fluxo Óptico Sobel KLT)
        tracker::SensorSample sensors{};
        sensors.has_imu_orientation = true;
        sensors.imu_yaw_rad         = physical_yaw;
        sensors.imu_pitch_rad       = physical_pitch;
        sensors.imu_roll_rad        = 0.0f;
        ar_tracker.process_frame(camera_frame, sensors, dt);
        ar_tracker.apply_manual_input(0.0f, 0.0f, 0.0f, 0.0f);

        // Sincroniza translação física no modo preview
        tracker::ArPose6DoF tracked_pose = ar_tracker.pose();
        tracked_pose.position = physical_cam_pos;

        // 3. Atualiza física de voo da Pokébola 3D e captura de Pokémons
        session.update(tracked_pose, dt, t);
        session.build_draw_commands(draw_cmds, t);

        // 4. Constrói Matriz View 6DoF a partir da pose AR rastreada e rasteriza os Pokémons 3D no G-Buffer
        const math::Mat4 view = math::Mat4::view_from_pose_6dof(
            tracked_pose.position, tracked_pose.yaw_rad, tracked_pose.pitch_rad, tracked_pose.roll_rad);
        const math::Mat4 proj = math::Mat4::perspective_vulkan_tty(deg_to_rad(45.0f), metrics, 0.35f, 35.0f);

        renderer::RenderStats rstats{};
        gpu.render_scene(draw_cmds, view, proj, t, 0.35f, 35.0f, &rstats);

        // 5. Funde Vídeo da Câmera em ASCII (Sobel 2D) + Pokémons/Pokébola em 3D (Sobel 3D)
        post_processor.process_ar_frame(gpu.gbuffer(), camera_frame, ar_tracker.tracked_points(), tty_fb, 0.35f, 35.0f);
        draw_ar_hud(tty_fb, tracked_pose, session, pp_cfg.mode, fps_ema, rstats.triangles_rasterized);

        if (snapshot_only) {
            std::printf("====================================================================================================\n");
            std::printf(" POKEMON GO ASCII-3D AR (SNAPSHOT) | GPU: %s | Track: %s (%u pts) | Tris: %u\n",
                        gpu.device_info().device_name,
                        tier_label(tracked_pose.active_tier),
                        tracked_pose.tracked_anchors,
                        rstats.triangles_rasterized);
            std::printf("====================================================================================================\n");
            for (u32 r = 0; r < tty_fb.rows(); ++r) {
                for (u32 c = 0; c < tty_fb.columns(); ++c) {
                    const u32 cp = tty_fb.at(c, r).codepoint;
                    std::putchar((cp >= 32 && cp < 127) ? static_cast<int>(cp) : '#');
                }
                std::putchar('\n');
            }
            break;
        } else {
            const std::string_view ansi = serializer.serialize(tty_fb, true);
            tty_dev.flush(ansi);
        }

        ++frame_idx;
        if (max_frames > 0 && frame_idx >= max_frames) {
            break;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    tty_dev.shutdown();
    return 0;
}

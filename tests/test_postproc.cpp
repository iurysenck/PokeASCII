#include "pokemon_ar/game/ar_game.hpp"
#include "pokemon_ar/postproc/ascii_postproc.hpp"

#include <cstdio>
#include <cstdlib>
#include <vector>

namespace {

int g_tests_run = 0;
int g_tests_failed = 0;

#define EXPECT_TRUE(cond) do { ++g_tests_run; if (!(cond)) { std::fprintf(stderr, "[FALHA] %s:%d: %s\n", __FILE__, __LINE__, #cond); ++g_tests_failed; } } while(0)

using namespace pokemon_ar;

void test_camera_and_3d_pokemon_fusion_plus_capture() {
    game::ArGameSession session;
    tracker::ArPose6DoF pose{};
    pose.position = {0.0f, 0.0f, 0.0f};
    pose.yaw_rad  = 0.0f;
    pose.pitch_rad = 0.0f;

    // 1. Verifica que o Pikachu inicial está diretamente na mira da câmera
    f32 dist = 0.0f, ang = 0.0f;
    const i32 target = session.find_targeted_pokemon(pose, dist, ang);
    EXPECT_TRUE(target == 0);
    EXPECT_TRUE(dist > 3.0f && dist < 4.0f);
    EXPECT_TRUE(ang < 0.05f);

    // 2. Arremessa uma Pokébola 3D na direção do Pikachu e simula a física até acertar e capturar!
    session.throw_pokeball(pose, 7.2f, 0.34f, 0.0f);
    EXPECT_TRUE(session.pokeball().state == game::PokeballState::Flying);

    bool hit_detected = false;
    for (int step = 0; step < 180; ++step) {
        session.update(pose, 0.025f, static_cast<f32>(step) * 0.025f);
        if (session.pokeball().state == game::PokeballState::CaptureShake) {
            hit_detected = true;
        }
        if (session.total_captured() >= 1) {
            break;
        }
    }
    EXPECT_TRUE(hit_detected);
    EXPECT_TRUE(session.total_captured() == 1u);

    // 3. Testa a fusão visual Câmera ASCII + Pokémon 3D no AsciiPostProcessor
    const u32 cols = 100, rows = 36;
    tracker::CameraFrameBuffer cam_fb(cols, rows);
    cam_fb.render_synthetic_environment(pose.position, pose.yaw_rad, pose.pitch_rad, 1.0f);

    renderer::GpuRenderer gpu;
    gpu.initialize(cols, rows);

    std::vector<renderer::DrawCommand> cmds;
    session.build_draw_commands(cmds, 1.0f);

    const TerminalMetrics tm{cols, rows, 9.0f, 18.0f};
    const math::Mat4 view = math::Mat4::view_from_pose_6dof(pose.position, pose.yaw_rad, pose.pitch_rad, 0.0f);
    const math::Mat4 proj = math::Mat4::perspective_vulkan_tty(deg_to_rad(45.0f), tm, 0.35f, 35.0f);
    gpu.render_scene(cmds, view, proj, 1.0f, 0.35f, 35.0f);

    tty::FrameBufferTTY tty_fb(cols, rows);
    postproc::AsciiPostProcessor post;
    post.process_ar_frame(gpu.gbuffer(), cam_fb, {}, tty_fb, 0.35f, 35.0f);

    u32 non_space_cells = 0;
    for (const tty::Cell& c : tty_fb.raw_cells()) {
        if (c.codepoint != U' ') {
            ++non_space_cells;
        }
    }
    EXPECT_TRUE(non_space_cells > 500u);
}

} // namespace

int main() {
    test_camera_and_3d_pokemon_fusion_plus_capture();
    if (g_tests_failed == 0) {
        std::printf("[SUCESSO] Modulo 6 & 7 (Camera+3D ASCII PostProc & Pokeball Capture): %d assercoes passaram.\n", g_tests_run);
        return EXIT_SUCCESS;
    }
    return EXIT_FAILURE;
}

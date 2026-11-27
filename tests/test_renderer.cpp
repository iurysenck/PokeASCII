#include "pokemon_ar/renderer/gpu_renderer.hpp"
#include "pokemon_ar/mesh/mesh.hpp"

#include <cstdio>
#include <cstdlib>
#include <vector>

namespace {

int g_tests_run = 0;
int g_tests_failed = 0;

#define EXPECT_TRUE(cond) do { ++g_tests_run; if (!(cond)) { std::fprintf(stderr, "[FALHA] %s:%d: %s\n", __FILE__, __LINE__, #cond); ++g_tests_failed; } } while(0)

using namespace pokemon_ar;
using namespace pokemon_ar::renderer;

void test_render_pikachu_gbuffer() {
    GpuRenderer gpu;
    EXPECT_TRUE(gpu.initialize(120, 40));

    const mesh::MeshData pikachu = mesh::procedural::create_pikachu();
    std::vector<DrawCommand> cmds;
    cmds.push_back(DrawCommand{
        &pikachu,
        math::Mat4::translation({0.0f, -1.2f, -3.2f}),
        {WaveDeformMode::CreatureIdleBounce, 0.15f, 5.0f, 3.0f, 0.0f},
        {1.0f, 1.0f, 1.0f},
        50
    });

    const TerminalMetrics tm{120, 40, 9.0f, 18.0f};
    const math::Mat4 view = math::Mat4::view_from_pose_6dof({0.0f, 0.0f, 0.0f}, 0.0f, 0.0f, 0.0f);
    const math::Mat4 proj = math::Mat4::perspective_vulkan_tty(deg_to_rad(45.0f), tm, 0.35f, 35.0f);

    RenderStats stats{};
    gpu.render_scene(cmds, view, proj, 0.5f, 0.35f, 35.0f, &stats);

    EXPECT_TRUE(stats.draw_calls == 1u);
    EXPECT_TRUE(stats.triangles_rasterized > 10u);
    EXPECT_TRUE(stats.fragments_shaded > 20u);
}

} // namespace

int main() {
    test_render_pikachu_gbuffer();
    if (g_tests_failed == 0) {
        std::printf("[SUCESSO] Modulo 5 (3D GpuRenderer): %d assercoes passaram.\n", g_tests_run);
        return EXIT_SUCCESS;
    }
    return EXIT_FAILURE;
}

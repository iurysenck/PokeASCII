#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"
#include "pokemon_ar/math/mat4.hpp"

#include <cmath>
#include <cstdio>
#include <cstdlib>

namespace {

int g_tests_run = 0;
int g_tests_failed = 0;

void expect_true_impl(bool cond, const char* expr, const char* file, int line) {
    ++g_tests_run;
    if (!cond) {
        std::fprintf(stderr, "[FALHA] %s:%d: %s\n", file, line, expr);
        ++g_tests_failed;
    }
}

void expect_near_impl(pokemon_ar::f32 a, pokemon_ar::f32 b, pokemon_ar::f32 tol, const char* file, int line) {
    ++g_tests_run;
    if (std::fabs(a - b) > tol) {
        std::fprintf(stderr, "[FALHA] %s:%d: %.6f != %.6f (tol=%.6f)\n", file, line, a, b, tol);
        ++g_tests_failed;
    }
}

#define EXPECT_TRUE(cond) expect_true_impl(static_cast<bool>(cond), #cond, __FILE__, __LINE__)
#define EXPECT_NEAR(a, b, tol) expect_near_impl((a), (b), (tol), __FILE__, __LINE__)

using namespace pokemon_ar;
using namespace pokemon_ar::math;

void test_6dof_view_pose_and_projections() {
    EXPECT_TRUE(sizeof(Vec4) == 16);
    EXPECT_TRUE(sizeof(Mat4) == 64);

    // Pose inicial na origem (0,0,0) olhando para frente (Yaw=0 -> -Z)
    const Mat4 view = Mat4::view_from_pose_6dof({0.0f, 0.0f, 0.0f}, 0.0f, 0.0f, 0.0f);
    const Vec4 pt_in_front = view * Vec4{0.0f, 0.0f, -3.5f, 1.0f};
    EXPECT_NEAR(pt_in_front.x, 0.0f, 1e-4f);
    EXPECT_NEAR(pt_in_front.y, 0.0f, 1e-4f);
    EXPECT_NEAR(pt_in_front.z, -3.5f, 1e-4f);

    // Girando a câmera 90 graus para a direita (Yaw = +Pi/2 -> olha para +X)
    const Mat4 view_right = Mat4::view_from_pose_6dof({0.0f, 0.0f, 0.0f}, kHalfPi, 0.0f, 0.0f);
    const Vec4 pt_east = view_right * Vec4{4.0f, 0.0f, 0.0f, 1.0f};
    EXPECT_NEAR(pt_east.x, 0.0f, 1e-4f);
    EXPECT_NEAR(pt_east.z, -4.0f, 1e-4f);

    const TerminalMetrics tm{120, 40, 9.0f, 18.0f};
    EXPECT_NEAR(tm.effective_aspect_ratio(), 1.5f, 1e-5f);

    const Mat4 proj = Mat4::perspective_vulkan_tty(deg_to_rad(45.0f), tm, 0.5f, 40.0f);
    const Vec3 ndc_near = clip_to_ndc(proj * Vec4{0.0f, 0.0f, -0.5f, 1.0f});
    const Vec3 ndc_far  = clip_to_ndc(proj * Vec4{0.0f, 0.0f, -40.0f, 1.0f});
    EXPECT_NEAR(ndc_near.z, 0.0f, 1e-5f);
    EXPECT_NEAR(ndc_far.z,  1.0f, 1e-5f);
}

} // namespace

int main() {
    test_6dof_view_pose_and_projections();
    if (g_tests_failed == 0) {
        std::printf("[SUCESSO] Modulo 1 (Math 6DoF AR): %d assercoes passaram.\n", g_tests_run);
        return EXIT_SUCCESS;
    }
    return EXIT_FAILURE;
}

#include "pokemon_ar/tracker/ar_tracker.hpp"

#include <cmath>
#include <cstdio>
#include <cstdlib>

namespace {

int g_tests_run = 0;
int g_tests_failed = 0;

#define EXPECT_TRUE(cond) do { ++g_tests_run; if (!(cond)) { std::fprintf(stderr, "[FALHA] %s:%d: %s\n", __FILE__, __LINE__, #cond); ++g_tests_failed; } } while(0)

using namespace pokemon_ar;
using namespace pokemon_ar::tracker;

void test_hardware_escalation_and_quality_governor() {
    AdaptiveArTracker tracker;

    // 1. Dispositivo com SLAM nativo (WebXR / ARCore)
    DeviceCapabilities caps_slam{};
    caps_slam.has_webxr_slam       = true;
    caps_slam.has_gpu_acceleration = true;
    caps_slam.cpu_logical_cores    = 8;
    tracker.configure_hardware(caps_slam);
    EXPECT_TRUE(tracker.pose().active_tier == TrackingTier::WebXR_SLAM_6DoF);
    EXPECT_TRUE(tracker.pose().active_quality == QualityProfile::Ultra_HighDensity);

    // 2. Dispositivo fraco sob carga térmica alta (> 28ms por frame) -> Governador rebaixa para Eco_UltraLight!
    for (int i = 0; i < 30; ++i) {
        tracker.update_quality_governor(0.032f);
    }
    EXPECT_TRUE(tracker.pose().active_quality == QualityProfile::Eco_UltraLight);

    // 3. Dispositivo sem Giroscópio (apenas câmera) -> Cai para Pure_Visual_SobelKLT
    DeviceCapabilities caps_cam_only{};
    caps_cam_only.has_camera_stream = true;
    caps_cam_only.has_gyroscope     = false;
    caps_cam_only.cpu_logical_cores = 4;
    tracker.configure_hardware(caps_cam_only);
    EXPECT_TRUE(tracker.pose().active_tier == TrackingTier::Pure_Visual_SobelKLT);
}

void test_sobel_klt_optical_flow_tracking() {
    AdaptiveArTracker tracker;
    DeviceCapabilities caps{};
    caps.has_camera_stream = true;
    caps.has_gyroscope     = false;
    caps.cpu_logical_cores = 4;
    tracker.configure_hardware(caps);

    CameraFrameBuffer frame0(120, 40);
    CameraFrameBuffer frame1(120, 40);

    // Frame 0: câmera olhando para yaw = 0.0
    frame0.render_synthetic_environment({0.0f, 0.0f, 0.0f}, 0.0f, 0.05f, 0.0f);
    SensorSample no_imu{};
    tracker.process_frame(frame0, no_imu, 0.016f);
    EXPECT_TRUE(tracker.pose().tracked_anchors >= 10);

    // Frame 1: câmera girou fisicamente para a direita (yaw = +0.04 rad)
    frame1.render_synthetic_environment({0.0f, 0.0f, 0.0f}, 0.04f, 0.05f, 0.016f);
    tracker.process_frame(frame1, no_imu, 0.016f);

    // O fluxo óptico Sobel KLT deve detectar o deslocamento horizontal dos objetos para a esquerda (dx < 0)
    // e atualizar o yaw estimado da câmera na direção positiva (+yaw)!
    EXPECT_TRUE(tracker.pose().optical_flow_px.x < -0.1f);
    EXPECT_TRUE(tracker.pose().yaw_rad > 0.005f);
}

} // namespace

int main() {
    test_hardware_escalation_and_quality_governor();
    test_sobel_klt_optical_flow_tracking();
    if (g_tests_failed == 0) {
        std::printf("[SUCESSO] Modulo 4 (Adaptive AR Tracker + Sobel KLT + Governor): %d assercoes passaram.\n", g_tests_run);
        return EXIT_SUCCESS;
    }
    return EXIT_FAILURE;
}

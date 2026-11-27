#pragma once

#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"
#include "pokemon_ar/math/mat4.hpp"
#include "pokemon_ar/tty/tty_presenter.hpp"

#include <vector>

namespace pokemon_ar::tracker {

/// Níveis hierárquicos de rastreamento 3D do ambiente (escalonamento progressivo de hardware).
enum class TrackingTier : u8 {
    WebXR_SLAM_6DoF               = 0, ///< SLAM nativo por hardware (ARCore / ARKit / WebXR Hit-Test)
    IMU_GyroGravity_Plus_SobelKLT = 1, ///< Fusão Giroscópio + Gravidade + Fluxo Óptico Sobel KLT (Zero-Drift)
    Pure_Visual_SobelKLT          = 2, ///< Rastreamento 100% Visual via Fluxo Óptico Sobel na grade ASCII (PC/Celular sem Giro)
    Manual_Fallback               = 3  ///< Controle por toque/teclado quando câmera e sensores estão indisponíveis
};

/// Perfis dinâmicos de qualidade gerenciados pelo Governador Adaptativo de FPS.
enum class QualityProfile : u8 {
    Ultra_HighDensity = 0, ///< 48 pontos KLT, modo Braille/ASCII-3D completo, deformação 3D máxima
    Balanced_Standard = 1, ///< 32 pontos KLT, modo ASCII-3D Sobel padrão a 60 FPS
    Eco_UltraLight    = 2  ///< 16 pontos KLT, tolerância ANSI aumentada para dispositivos antigos/fracos
};

/// Recursos de hardware detectados ou reportados pelo dispositivo em tempo de execução.
struct DeviceCapabilities {
    bool has_webxr_slam          = false;
    bool has_gyroscope           = false;
    bool has_accelerometer       = false;
    bool has_camera_stream       = true;
    bool has_gpu_acceleration    = false;
    u32  cpu_logical_cores       = 4;
};

/// Amostra de sensores inerciais (IMU: Giroscópio + Acelerômetro/Gravidade) ou Pose SLAM externa.
struct SensorSample {
    bool       has_external_slam_pose = false;
    math::Vec3 slam_position{0.0f, 0.0f, 0.0f};
    f32        slam_yaw_rad           = 0.0f;
    f32        slam_pitch_rad         = 0.0f;
    f32        slam_roll_rad          = 0.0f;

    bool       has_imu_orientation    = false;
    f32        imu_yaw_rad            = 0.0f;
    f32        imu_pitch_rad          = 0.0f;
    f32        imu_roll_rad           = 0.0f;

    bool       has_imu_angular_vel    = false;
    math::Vec3 gyro_rad_per_sec{0.0f, 0.0f, 0.0f}; ///< (pitch_rate, yaw_rate, roll_rate)

    bool       has_gravity_vector     = false;
    math::Vec3 gravity_dir{0.0f, -1.0f, 0.0f};     ///< Vetor gravidade normalizado no referencial da câmera
};

/// Pixel pré-processado do frame da câmera na resolução exata da grade ASCII.
/// Compartilhado diretamente entre o Rastreador KLT e o Quantizador ASCII (Zero retrabalho!).
struct CameraCellFeature {
    math::Vec3 rgb{0.0f, 0.0f, 0.0f}; ///< Cor RGB normalizada [0..1] do mundo real
    f32        luminance  = 0.0f;     ///< Luminância ITU-R BT.709 Y em [0..1]
    f32        sobel_gx   = 0.0f;     ///< Gradiente horizontal Sobel 3x3
    f32        sobel_gy   = 0.0f;     ///< Gradiente vertical Sobel 3x3
    f32        grad_mag   = 0.0f;     ///< Magnitude do gradiente sqrt(Gx^2 + Gy^2)
    f32        harris_score = 0.0f;   ///< Pontuação de canto estrutural para ancoragem KLT
};

/// Buffer de imagem da câmera já reamostrado para a baixa resolução da grade ASCII (ex: 130x38).
class CameraFrameBuffer {
public:
    CameraFrameBuffer() = default;
    CameraFrameBuffer(u32 width, u32 height) { resize(width, height); }

    void resize(u32 width, u32 height);

    [[nodiscard]] u32 width() const noexcept { return width_; }
    [[nodiscard]] u32 height() const noexcept { return height_; }
    [[nodiscard]] std::size_t size() const noexcept { return cells_.size(); }

    [[nodiscard]] CameraCellFeature& at(u32 x, u32 y) noexcept {
        return cells_[static_cast<std::size_t>(y) * width_ + x];
    }

    [[nodiscard]] const CameraCellFeature& at(u32 x, u32 y) const noexcept {
        return cells_[static_cast<std::size_t>(y) * width_ + x];
    }

    /// Calcula luminância, gradientes Sobel (Gx, Gy) e Harris Corner Score em uma única passagem rápida.
    void compute_sobel_and_features() noexcept;

    /// Gera um frame sintético realista de um ambiente 3D (parque/sala com árvores, piso ladrilhado e horizonte)
    /// projetado pela pose da câmera — usado para testes determinísticos e modo terminal sem webcam física.
    void render_synthetic_environment(const math::Vec3& true_cam_pos,
                                      f32 true_yaw_rad,
                                      f32 true_pitch_rad,
                                      f32 time_sec) noexcept;

private:
    u32 width_  = 0;
    u32 height_ = 0;
    std::vector<CameraCellFeature> cells_;
};

/// Ponto característico do ambiente real rastreado entre frames consecutivos.
struct TrackedFeaturePoint {
    f32  x        = 0.0f;
    f32  y        = 0.0f;
    f32  prev_x   = 0.0f;
    f32  prev_y   = 0.0f;
    f32  strength = 0.0f;
    bool valid    = false;
};

/// Pose 6DoF estimada da câmera no mundo real + telemetria de estabilidade.
struct ArPose6DoF {
    math::Vec3   position{0.0f, 0.0f, 0.0f}; ///< Posição (X, Y, Z) da câmera em metros acima do centro da arena
    f32          yaw_rad           = 0.0f;   ///< Rotação horizontal (radianos)
    f32          pitch_rad         = 0.0f;   ///< Inclinação vertical (radianos)
    f32          roll_rad          = 0.0f;   ///< Inclinação lateral (radianos)
    f32          floor_y_meters    = -1.25f; ///< Altura estimada do chão real (Y = -1.25m abaixo da câmera)

    TrackingTier   active_tier     = TrackingTier::Pure_Visual_SobelKLT;
    QualityProfile active_quality  = QualityProfile::Balanced_Standard;
    u32            tracked_anchors = 0;      ///< Quantidade de pontos do ambiente ancorados com sucesso no frame
    f32            tracking_confidence = 1.0f; ///< Confiança [0..1] da estabilidade do rastreamento
    math::Vec2     optical_flow_px{0.0f, 0.0f}; ///< Deslocamento mediano (dx, dy) em células detectado na câmera
    f32            radial_expansion = 1.0f;  ///< Fator de expansão radial (>1 = andando para frente)
};

/// Rastreador 3D Adaptativo de Ambiente (Sensor Fusion IMU + Fluxo Óptico Sobel KLT + Governador de FPS).
class AdaptiveArTracker {
public:
    AdaptiveArTracker();

    /// Configura os recursos de hardware detectados no dispositivo e seleciona o melhor Tier.
    void configure_hardware(const DeviceCapabilities& caps) noexcept;

    [[nodiscard]] const DeviceCapabilities& capabilities() const noexcept { return caps_; }
    [[nodiscard]] const ArPose6DoF& pose() const noexcept { return pose_; }
    [[nodiscard]] const std::vector<TrackedFeaturePoint>& tracked_points() const noexcept { return active_points_; }

    /// Reinicia/recalibra a âncora do mundo para a direção atual da câmera.
    void reset_world_anchor() noexcept;

    /// Aplica incremento manual de câmera (teclado W/A/S/D ou arraste de calibração).
    void apply_manual_input(f32 delta_yaw, f32 delta_pitch, f32 forward_step, f32 strafe_step) noexcept;

    /// Atualiza o Governador Dinâmico de Estabilidade com base no tempo real gasto no último frame.
    void update_quality_governor(f32 frame_dt_sec) noexcept;

    /// Processa um novo frame da câmera (já com Sobel calculado) + amostra de sensores e atualiza a Pose 6DoF.
    void process_frame(const CameraFrameBuffer& current_frame,
                       const SensorSample& sensors,
                       f32 dt_sec);

private:
    void detect_new_features(const CameraFrameBuffer& frame, u32 max_points) noexcept;
    void track_klt_optical_flow(const CameraFrameBuffer& prev_frame,
                                const CameraFrameBuffer& curr_frame,
                                math::Vec2& out_median_flow,
                                f32& out_radial_scale,
                                u32& out_valid_count) noexcept;

    DeviceCapabilities caps_{};
    ArPose6DoF         pose_{};
    CameraFrameBuffer  prev_frame_{};
    bool               has_prev_frame_ = false;

    std::vector<TrackedFeaturePoint> active_points_;
    std::vector<f32>                 scratch_dx_;
    std::vector<f32>                 scratch_dy_;
    std::vector<f32>                 scratch_scale_;

    f32 ema_frame_ms_          = 16.0f;
    u32 governor_stable_frames_ = 0;
};

} // namespace pokemon_ar::tracker

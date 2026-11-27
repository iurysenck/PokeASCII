#include "pokemon_ar/tracker/ar_tracker.hpp"

#include <algorithm>
#include <cmath>

namespace pokemon_ar::tracker {

void CameraFrameBuffer::resize(u32 width, u32 height) {
    if (width_ == width && height_ == height) {
        return;
    }
    width_  = width;
    height_ = height;
    cells_.resize(static_cast<std::size_t>(width) * height);
}

void CameraFrameBuffer::compute_sobel_and_features() noexcept {
    if (width_ < 3 || height_ < 3) {
        return;
    }

    // 1. Calcula luminância perceptual ITU-R BT.709 para cada célula
    for (CameraCellFeature& c : cells_) {
        c.luminance    = 0.2126f * c.rgb.x + 0.7152f * c.rgb.y + 0.0722f * c.rgb.z;
        c.sobel_gx     = 0.0f;
        c.sobel_gy     = 0.0f;
        c.grad_mag     = 0.0f;
        c.harris_score = 0.0f;
    }

    // 2. Filtro Sobel 3x3 + Resposta Estrutural de Canto de Harris (reaproveitando Gx e Gy!)
    for (u32 y = 1; y + 1 < height_; ++y) {
        for (u32 x = 1; x + 1 < width_; ++x) {
            const f32 l00 = at(x - 1, y - 1).luminance;
            const f32 l10 = at(x,     y - 1).luminance;
            const f32 l20 = at(x + 1, y - 1).luminance;

            const f32 l01 = at(x - 1, y).luminance;
            const f32 l21 = at(x + 1, y).luminance;

            const f32 l02 = at(x - 1, y + 1).luminance;
            const f32 l12 = at(x,     y + 1).luminance;
            const f32 l22 = at(x + 1, y + 1).luminance;

            const f32 gx = (l20 + 2.0f * l21 + l22) - (l00 + 2.0f * l01 + l02);
            const f32 gy = (l02 + 2.0f * l12 + l22) - (l00 + 2.0f * l10 + l20);
            const f32 mag = std::sqrt(gx * gx + gy * gy);

            CameraCellFeature& center = at(x, y);
            center.sobel_gx = gx;
            center.sobel_gy = gy;
            center.grad_mag = mag;

            // Aproximação ultra-leve de canto local: forte gradiente tanto em X quanto em Y
            const f32 ixx = gx * gx;
            const f32 iyy = gy * gy;
            const f32 trace = ixx + iyy;
            if (trace > 1e-4f) {
                center.harris_score = (ixx * iyy) / trace + 0.15f * mag;
            }
        }
    }
}

void CameraFrameBuffer::render_synthetic_environment(const math::Vec3& true_cam_pos,
                                                     f32 true_yaw_rad,
                                                     f32 true_pitch_rad,
                                                     f32 time_sec) noexcept {
    if (width_ == 0 || height_ == 0) {
        return;
    }

    const f32 fov_x = deg_to_rad(70.0f);
    const f32 fov_y = deg_to_rad(45.0f);

    for (u32 y = 0; y < height_; ++y) {
        const f32 ny = (static_cast<f32>(y) / static_cast<f32>(height_)) - 0.5f;
        const f32 ray_pitch = true_pitch_rad - ny * fov_y;

        for (u32 x = 0; x < width_; ++x) {
            const f32 nx = (static_cast<f32>(x) / static_cast<f32>(width_)) - 0.5f;
            const f32 ray_yaw = true_yaw_rad + nx * fov_x;

            math::Vec3 col{0.10f, 0.16f, 0.28f};

            if (ray_pitch < -0.02f) {
                // Raio intercepta o plano do chão real (Y = -1.25m)
                const f32 cam_h = 1.25f + true_cam_pos.y;
                const f32 dist  = std::min(30.0f, cam_h / std::max(0.02f, -std::tan(ray_pitch)));
                const f32 wx    = true_cam_pos.x + std::sin(ray_yaw) * dist;
                const f32 wz    = true_cam_pos.z - std::cos(ray_yaw) * dist;

                // Padrão de ladrilhos/grama do mundo real com marcos estruturais bem definidos para o KLT
                const i32 tile_x = static_cast<i32>(std::floor(wx * 1.2f));
                const i32 tile_z = static_cast<i32>(std::floor(wz * 1.2f));
                const bool checker = ((tile_x ^ tile_z) & 1) != 0;

                const f32 grass_noise = 0.06f * std::sin(wx * 3.7f) * std::cos(wz * 3.7f);
                if (checker) {
                    col = {0.14f + grass_noise, 0.34f + grass_noise, 0.18f};
                } else {
                    col = {0.22f + grass_noise, 0.44f + grass_noise, 0.24f};
                }

                // Caminho de pedras central no parque AR
                if (std::fabs(wx) < 1.1f) {
                    col = checker ? math::Vec3{0.42f, 0.40f, 0.36f} : math::Vec3{0.32f, 0.30f, 0.27f};
                }
            } else {
                // Horizonte: árvores, prédios silhuetados e céu
                const f32 sky_t = std::clamp(ray_pitch / 0.5f, 0.0f, 1.0f);
                col = math::Vec3{0.22f, 0.48f, 0.78f} * (1.0f - sky_t) + math::Vec3{0.08f, 0.20f, 0.46f} * sky_t;

                // Silhueta de árvores/prédios no horizonte ancorados em ângulos fixos do mundo (ray_yaw)
                const f32 tree_hill = 0.12f + 0.07f * std::sin(ray_yaw * 5.0f) + 0.04f * std::cos(ray_yaw * 13.0f);
                if (ray_pitch < tree_hill) {
                    const f32 bark = 0.5f + 0.5f * std::sin(ray_yaw * 28.0f);
                    col = {0.10f + 0.08f * bark, 0.28f + 0.12f * bark, 0.14f};
                } else {
                    // Nuvens suaves
                    const f32 cloud = std::max(0.0f, std::sin(ray_yaw * 4.0f + time_sec * 0.02f) * std::cos(ray_pitch * 12.0f));
                    col += math::Vec3{0.25f, 0.25f, 0.25f} * (cloud * 0.5f);
                }
            }

            col.x = std::clamp(col.x, 0.0f, 1.0f);
            col.y = std::clamp(col.y, 0.0f, 1.0f);
            col.z = std::clamp(col.z, 0.0f, 1.0f);
            at(x, y).rgb = col;
        }
    }

    compute_sobel_and_features();
}

AdaptiveArTracker::AdaptiveArTracker() {
    active_points_.reserve(64);
    scratch_dx_.reserve(64);
    scratch_dy_.reserve(64);
    scratch_scale_.reserve(64);
    configure_hardware(DeviceCapabilities{});
}

void AdaptiveArTracker::configure_hardware(const DeviceCapabilities& caps) noexcept {
    caps_ = caps;

    if (caps_.has_webxr_slam) {
        pose_.active_tier = TrackingTier::WebXR_SLAM_6DoF;
    } else if (caps_.has_gyroscope && caps_.has_camera_stream) {
        pose_.active_tier = TrackingTier::IMU_GyroGravity_Plus_SobelKLT;
    } else if (caps_.has_camera_stream) {
        pose_.active_tier = TrackingTier::Pure_Visual_SobelKLT;
    } else {
        pose_.active_tier = TrackingTier::Manual_Fallback;
    }

    if (caps_.cpu_logical_cores >= 6 || caps_.has_gpu_acceleration) {
        pose_.active_quality = QualityProfile::Ultra_HighDensity;
    } else if (caps_.cpu_logical_cores >= 2) {
        pose_.active_quality = QualityProfile::Balanced_Standard;
    } else {
        pose_.active_quality = QualityProfile::Eco_UltraLight;
    }
}

void AdaptiveArTracker::reset_world_anchor() noexcept {
    pose_.position         = {0.0f, 0.0f, 0.0f};
    pose_.yaw_rad          = 0.0f;
    pose_.pitch_rad        = 0.05f;
    pose_.roll_rad         = 0.0f;
    pose_.floor_y_meters   = -1.25f;
    pose_.optical_flow_px  = {0.0f, 0.0f};
    pose_.radial_expansion = 1.0f;
    has_prev_frame_        = false;
    active_points_.clear();
}

void AdaptiveArTracker::apply_manual_input(f32 delta_yaw, f32 delta_pitch, f32 forward_step, f32 strafe_step) noexcept {
    pose_.yaw_rad   += delta_yaw;
    pose_.pitch_rad  = std::clamp(pose_.pitch_rad + delta_pitch, -0.65f, 0.75f);

    const f32 sy = std::sin(pose_.yaw_rad);
    const f32 cy = std::cos(pose_.yaw_rad);
    pose_.position.x += sy * forward_step + cy * strafe_step;
    pose_.position.z += -cy * forward_step + sy * strafe_step;
}

void AdaptiveArTracker::update_quality_governor(f32 frame_dt_sec) noexcept {
    const f32 ms = std::clamp(frame_dt_sec * 1000.0f, 1.0f, 100.0f);
    ema_frame_ms_ = ema_frame_ms_ * 0.88f + ms * 0.12f;

    // Se o dispositivo estiver sofrendo (> 22ms / < 45 FPS), reduz perfil imediatamente para manter estabilidade!
    if (ema_frame_ms_ > 22.0f) {
        governor_stable_frames_ = 0;
        if (pose_.active_quality == QualityProfile::Ultra_HighDensity) {
            pose_.active_quality = QualityProfile::Balanced_Standard;
        } else if (pose_.active_quality == QualityProfile::Balanced_Standard) {
            pose_.active_quality = QualityProfile::Eco_UltraLight;
        }
    } else if (ema_frame_ms_ < 11.0f) {
        // Se estiver rodando com folga (< 11ms / > 90 FPS internos) por 60 frames seguidos, promove qualidade
        ++governor_stable_frames_;
        if (governor_stable_frames_ >= 60) {
            governor_stable_frames_ = 0;
            if (pose_.active_quality == QualityProfile::Eco_UltraLight) {
                pose_.active_quality = QualityProfile::Balanced_Standard;
            } else if (pose_.active_quality == QualityProfile::Balanced_Standard &&
                       (caps_.has_gpu_acceleration || caps_.cpu_logical_cores >= 4)) {
                pose_.active_quality = QualityProfile::Ultra_HighDensity;
            }
        }
    }
}

void AdaptiveArTracker::detect_new_features(const CameraFrameBuffer& frame, u32 max_points) noexcept {
    active_points_.clear();
    const u32 w = frame.width();
    const u32 h = frame.height();
    if (w < 12 || h < 12 || max_points == 0) {
        return;
    }

    // Divide a tela em blocos espaciais (Grid Bucketing) para espalhar âncoras uniformemente pelo ambiente
    const u32 grid_cols = 6;
    const u32 grid_rows = 4;
    const u32 cell_w = std::max(1u, (w - 6) / grid_cols);
    const u32 cell_h = std::max(1u, (h - 6) / grid_rows);

    for (u32 gr = 0; gr < grid_rows; ++gr) {
        for (u32 gc = 0; gc < grid_cols; ++gc) {
            if (active_points_.size() >= max_points) {
                break;
            }
            const u32 x_start = 3 + gc * cell_w;
            const u32 y_start = 3 + gr * cell_h;
            const u32 x_end   = std::min(w - 3, x_start + cell_w);
            const u32 y_end   = std::min(h - 3, y_start + cell_h);

            f32 best_score = 0.04f; // Limiar mínimo de canto Sobel
            u32 best_x = 0, best_y = 0;

            for (u32 y = y_start; y < y_end; ++y) {
                for (u32 x = x_start; x < x_end; ++x) {
                    const f32 score = frame.at(x, y).harris_score;
                    if (score > best_score) {
                        best_score = score;
                        best_x = x;
                        best_y = y;
                    }
                }
            }

            if (best_x > 0 && best_y > 0) {
                TrackedFeaturePoint pt{};
                pt.x        = static_cast<f32>(best_x);
                pt.y        = static_cast<f32>(best_y);
                pt.prev_x   = pt.x;
                pt.prev_y   = pt.y;
                pt.strength = best_score;
                pt.valid    = true;
                active_points_.push_back(pt);
            }
        }
    }
}

void AdaptiveArTracker::track_klt_optical_flow(const CameraFrameBuffer& prev_frame,
                                               const CameraFrameBuffer& curr_frame,
                                               math::Vec2& out_median_flow,
                                               f32& out_radial_scale,
                                               u32& out_valid_count) noexcept {
    out_median_flow  = {0.0f, 0.0f};
    out_radial_scale = 1.0f;
    out_valid_count  = 0;

    const i32 w = static_cast<i32>(curr_frame.width());
    const i32 h = static_cast<i32>(curr_frame.height());
    if (w < 12 || h < 12 || prev_frame.width() != curr_frame.width() || prev_frame.height() != curr_frame.height()) {
        return;
    }

    scratch_dx_.clear();
    scratch_dy_.clear();

    // Patch Matching 3x3 + Refinamento Sub-Célula por Gradiente Sobel (Lucas-Kanade KLT)
    const i32 search_radius = 4;

    for (TrackedFeaturePoint& pt : active_points_) {
        if (!pt.valid) {
            continue;
        }
        const i32 px = static_cast<i32>(std::lround(pt.x));
        const i32 py = static_cast<i32>(std::lround(pt.y));
        if (px < 5 || px >= w - 5 || py < 5 || py >= h - 5) {
            pt.valid = false;
            continue;
        }

        f32 best_sad = 1e9f;
        i32 best_dx = 0;
        i32 best_dy = 0;

        for (i32 dy = -search_radius; dy <= search_radius; ++dy) {
            for (i32 dx = -search_radius; dx <= search_radius; ++dx) {
                const i32 cx = px + dx;
                const i32 cy = py + dy;
                if (cx < 2 || cx >= w - 2 || cy < 2 || cy >= h - 2) {
                    continue;
                }

                // Soma das Diferenças Absolutas (SAD) em janela 3x3 combinando Luminância + Gradiente Sobel
                f32 sad = 0.0f;
                for (i32 wy = -1; wy <= 1; ++wy) {
                    for (i32 wx = -1; wx <= 1; ++wx) {
                        const CameraCellFeature& p_cell = prev_frame.at(static_cast<u32>(px + wx), static_cast<u32>(py + wy));
                        const CameraCellFeature& c_cell = curr_frame.at(static_cast<u32>(cx + wx), static_cast<u32>(cy + wy));
                        sad += std::fabs(p_cell.luminance - c_cell.luminance) +
                               0.25f * std::fabs(p_cell.sobel_gx - c_cell.sobel_gx) +
                               0.25f * std::fabs(p_cell.sobel_gy - c_cell.sobel_gy);
                    }
                }
                // Leve regularização para preferir menor deslocamento em áreas ambíguas
                sad += 0.004f * static_cast<f32>(dx * dx + dy * dy);

                if (sad < best_sad) {
                    best_sad = sad;
                    best_dx  = dx;
                    best_dy  = dy;
                }
            }
        }

        if (best_sad > 1.8f) {
            pt.valid = false;
            continue;
        }

        // Refinamento Sub-Pixel 1-Step Lucas-Kanade usando os gradientes Sobel já calculados!
        const i32 nx = px + best_dx;
        const i32 ny = py + best_dy;
        const CameraCellFeature& p_center = prev_frame.at(static_cast<u32>(px), static_cast<u32>(py));
        const CameraCellFeature& c_center = curr_frame.at(static_cast<u32>(nx), static_cast<u32>(ny));
        const f32 it = c_center.luminance - p_center.luminance;
        const f32 gx = c_center.sobel_gx;
        const f32 gy = c_center.sobel_gy;
        const f32 denom = gx * gx + gy * gy + 0.05f;

        const f32 sub_dx = std::clamp(-it * gx / denom, -0.75f, 0.75f);
        const f32 sub_dy = std::clamp(-it * gy / denom, -0.75f, 0.75f);

        const f32 total_dx = static_cast<f32>(best_dx) + sub_dx;
        const f32 total_dy = static_cast<f32>(best_dy) + sub_dy;

        pt.prev_x = pt.x;
        pt.prev_y = pt.y;
        pt.x += total_dx;
        pt.y += total_dy;

        scratch_dx_.push_back(total_dx);
        scratch_dy_.push_back(total_dy);
        ++out_valid_count;
    }

    if (out_valid_count == 0) {
        return;
    }

    // Filtro Mediano (RANSAC / Outlier Rejection): ignora objetos móveis na cena e isola o movimento real da câmera!
    const std::size_t mid = scratch_dx_.size() / 2;
    std::nth_element(scratch_dx_.begin(), scratch_dx_.begin() + static_cast<std::ptrdiff_t>(mid), scratch_dx_.end());
    std::nth_element(scratch_dy_.begin(), scratch_dy_.begin() + static_cast<std::ptrdiff_t>(mid), scratch_dy_.end());
    out_median_flow.x = scratch_dx_[mid];
    out_median_flow.y = scratch_dy_[mid];

    // Estima expansão radial (zoom/caminhada para frente ou para trás) em relação ao centro óptico da imagem
    const f32 cx = static_cast<f32>(w) * 0.5f;
    const f32 cy = static_cast<f32>(h) * 0.5f;
    scratch_scale_.clear();

    for (const TrackedFeaturePoint& pt : active_points_) {
        if (!pt.valid) {
            continue;
        }
        const f32 r_prev = std::hypot(pt.prev_x - cx, pt.prev_y - cy);
        const f32 r_curr = std::hypot((pt.x - out_median_flow.x) - cx, (pt.y - out_median_flow.y) - cy);
        if (r_prev > 8.0f) {
            scratch_scale_.push_back(std::clamp(r_curr / r_prev, 0.85f, 1.15f));
        }
    }

    if (!scratch_scale_.empty()) {
        const std::size_t smid = scratch_scale_.size() / 2;
        std::nth_element(scratch_scale_.begin(), scratch_scale_.begin() + static_cast<std::ptrdiff_t>(smid), scratch_scale_.end());
        out_radial_scale = scratch_scale_[smid];
    }
}

void AdaptiveArTracker::process_frame(const CameraFrameBuffer& current_frame,
                                      const SensorSample& sensors,
                                      f32 dt_sec) {
    update_quality_governor(dt_sec);

    const u32 target_pts = (pose_.active_quality == QualityProfile::Ultra_HighDensity) ? 48u :
                           (pose_.active_quality == QualityProfile::Balanced_Standard) ? 32u : 16u;

    // Tier 0: Se o dispositivo entregou pose SLAM 6DoF nativa por hardware (WebXR ARCore/ARKit)
    if (sensors.has_external_slam_pose) {
        pose_.active_tier         = TrackingTier::WebXR_SLAM_6DoF;
        pose_.position            = sensors.slam_position;
        pose_.yaw_rad             = sensors.slam_yaw_rad;
        pose_.pitch_rad           = sensors.slam_pitch_rad;
        pose_.roll_rad            = sensors.slam_roll_rad;
        pose_.tracked_anchors     = target_pts;
        pose_.tracking_confidence = 1.0f;
        return;
    }

    // Executa rastreamento visual Sobel KLT se tivermos frame de câmera válido
    math::Vec2 median_flow{0.0f, 0.0f};
    f32 radial_scale = 1.0f;
    u32 valid_count  = 0;

    if (current_frame.width() >= 12 && current_frame.height() >= 12) {
        if (!has_prev_frame_ || active_points_.size() < target_pts / 3) {
            detect_new_features(current_frame, target_pts);
        }

        if (has_prev_frame_) {
            track_klt_optical_flow(prev_frame_, current_frame, median_flow, radial_scale, valid_count);
        }

        // Re-detecta novos pontos se mais da metade saiu de quadro
        if (valid_count < target_pts / 2) {
            detect_new_features(current_frame, target_pts);
            valid_count = static_cast<u32>(active_points_.size());
        }

        prev_frame_     = current_frame;
        has_prev_frame_ = true;
    }

    pose_.optical_flow_px  = median_flow;
    pose_.radial_expansion = radial_scale;
    pose_.tracked_anchors  = valid_count;

    // Converte deslocamento óptico em células (dx, dy) para variação angular da câmera
    // Se a câmera gira para a direita (+yaw), os objetos do mundo se movem para a esquerda na imagem (-dx)!
    const f32 fov_x_rad = deg_to_rad(70.0f);
    const f32 fov_y_rad = deg_to_rad(45.0f);
    const f32 visual_dyaw   = (current_frame.width() > 0)
                                  ? (-median_flow.x / static_cast<f32>(current_frame.width())) * fov_x_rad
                                  : 0.0f;
    const f32 visual_dpitch = (current_frame.height() > 0)
                                  ? (median_flow.y / static_cast<f32>(current_frame.height())) * fov_y_rad
                                  : 0.0f;

    // Tier 1: Fusão Complementar IMU (Giroscópio + Gravidade) + Correção de Drift via Sobel KLT
    if (sensors.has_imu_orientation || sensors.has_imu_angular_vel) {
        pose_.active_tier = TrackingTier::IMU_GyroGravity_Plus_SobelKLT;

        if (sensors.has_imu_orientation) {
            // Filtro complementar: IMU domina alta frequência (92%), KLT ancora baixa frequência contra drift (8%)
            const f32 fused_yaw   = sensors.imu_yaw_rad;
            const f32 fused_pitch = sensors.imu_pitch_rad;
            pose_.yaw_rad   = pose_.yaw_rad * 0.10f + (fused_yaw + visual_dyaw * 0.25f) * 0.90f;
            pose_.pitch_rad = std::clamp(pose_.pitch_rad * 0.10f + fused_pitch * 0.90f, -0.75f, 0.75f);
            pose_.roll_rad  = sensors.imu_roll_rad * 0.85f;
        } else if (sensors.has_imu_angular_vel) {
            const f32 gyro_dyaw   = sensors.gyro_rad_per_sec.y * dt_sec;
            const f32 gyro_dpitch = sensors.gyro_rad_per_sec.x * dt_sec;
            pose_.yaw_rad   += 0.75f * gyro_dyaw   + 0.25f * visual_dyaw;
            pose_.pitch_rad  = std::clamp(pose_.pitch_rad + 0.75f * gyro_dpitch + 0.25f * visual_dpitch, -0.75f, 0.75f);
        }

        // Se o acelerômetro informar o vetor gravidade, trava o horizonte de pitch/roll sem drift!
        if (sensors.has_gravity_vector) {
            const math::Vec3 g = sensors.gravity_dir.normalized();
            const f32 grav_pitch = std::asin(std::clamp(g.z, -0.85f, 0.85f));
            pose_.pitch_rad = pose_.pitch_rad * 0.85f + grav_pitch * 0.15f;
        }
    } else if (current_frame.width() > 0) {
        // Tier 2: Rastreamento 100% Visual via Fluxo Óptico Sobel KLT (funciona em qualquer dispositivo com câmera!)
        pose_.active_tier = TrackingTier::Pure_Visual_SobelKLT;
        pose_.yaw_rad    += visual_dyaw;
        pose_.pitch_rad   = std::clamp(pose_.pitch_rad + visual_dpitch, -0.70f, 0.70f);
    } else {
        pose_.active_tier = TrackingTier::Manual_Fallback;
    }

    // Translação 3D para frente/trás estimada pela divergência radial dos pontos KLT (quando você caminha até o Pokémon)
    if (std::fabs(radial_scale - 1.0f) > 0.003f && valid_count >= 6) {
        const f32 forward_step = std::clamp((radial_scale - 1.0f) * 4.5f, -0.25f, 0.25f);
        pose_.position.x += std::sin(pose_.yaw_rad) * forward_step;
        pose_.position.z += -std::cos(pose_.yaw_rad) * forward_step;
    }

    pose_.tracking_confidence = std::clamp(static_cast<f32>(valid_count) / static_cast<f32>( std::max(1u, target_pts / 2)), 0.15f, 1.0f);
}

} // namespace pokemon_ar::tracker

#pragma once

#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"
#include "pokemon_ar/math/mat4.hpp"
#include "pokemon_ar/mesh/mesh.hpp"

#include <algorithm>
#include <span>
#include <vector>

namespace pokemon_ar::renderer {

/// Pixel do G-Buffer alinhado em 16 bytes (32 bytes por amostra).
struct alignas(16) GBufferPixel {
    math::Vec3 albedo{0.0f, 0.0f, 0.0f};       ///< Cor RGB iluminada [0..1]
    f32        linear_depth = 100.0f;          ///< Profundidade linear no espaço de visão [z_near..z_far]
    math::Vec3 view_normal{0.0f, 0.0f, 1.0f};  ///< Normal no espaço de visão (View Space)
    u32        entity_id = 0;                  ///< 0 = fundo da câmera real, >0 = ID único da entidade 3D AR
};

static_assert(sizeof(GBufferPixel) == 32, "GBufferPixel deve ocupar exatos 32 bytes");

/// Buffer Offscreen 2D contíguo produzido pelo passe de rasterização 3D.
class GBuffer {
public:
    GBuffer() = default;
    GBuffer(u32 width, u32 height) { resize(width, height); }

    void resize(u32 width, u32 height) {
        width_  = width;
        height_ = height;
        const std::size_t total = static_cast<std::size_t>(width) * height;
        pixels_.resize(total);
        ndc_depth_.resize(total, 1.0f);
    }

    void clear(const math::Vec3& clear_color, f32 z_far) noexcept {
        GBufferPixel bg{};
        bg.albedo       = clear_color;
        bg.linear_depth = z_far;
        bg.view_normal  = {0.0f, 0.0f, 1.0f};
        bg.entity_id    = 0;
        std::fill(pixels_.begin(), pixels_.end(), bg);
        std::fill(ndc_depth_.begin(), ndc_depth_.end(), 1.0f);
    }

    [[nodiscard]] u32 width() const noexcept { return width_; }
    [[nodiscard]] u32 height() const noexcept { return height_; }
    [[nodiscard]] std::size_t size() const noexcept { return pixels_.size(); }

    [[nodiscard]] GBufferPixel& at(u32 x, u32 y) noexcept {
        return pixels_[static_cast<std::size_t>(y) * width_ + x];
    }

    [[nodiscard]] const GBufferPixel& at(u32 x, u32 y) const noexcept {
        return pixels_[static_cast<std::size_t>(y) * width_ + x];
    }

    [[nodiscard]] f32& ndc_depth_at(u32 x, u32 y) noexcept {
        return ndc_depth_[static_cast<std::size_t>(y) * width_ + x];
    }

    [[nodiscard]] f32 ndc_depth_at(u32 x, u32 y) const noexcept {
        return ndc_depth_[static_cast<std::size_t>(y) * width_ + x];
    }

    [[nodiscard]] const std::vector<GBufferPixel>& raw_pixels() const noexcept { return pixels_; }

private:
    u32 width_  = 0;
    u32 height_ = 0;
    std::vector<GBufferPixel> pixels_;
    std::vector<f32>          ndc_depth_;
};

/// Tipo de animação procedural de vértices para criaturas 3D no ambiente AR.
enum class WaveDeformMode : u8 {
    None               = 0, ///< Malha rígida (Pokébola, anel de chão)
    CreatureIdleBounce = 1, ///< Respiração orgânica + balanço de cauda/orelhas proporcional a uv.x
    GhostFloat         = 2  ///< Levitação espectral senoidal e ondulação de gás (Gastly)
};

struct VertexWaveParams {
    WaveDeformMode mode      = WaveDeformMode::None;
    f32            amplitude = 0.0f;
    f32            frequency = 4.0f;
    f32            spatial_k = 3.0f;
    f32            phase     = 0.0f;
};

struct DrawCommand {
    const mesh::MeshData* mesh         = nullptr;
    math::Mat4            model_matrix = math::Mat4::identity();
    VertexWaveParams      wave{};
    math::Vec3            tint_color{1.0f, 1.0f, 1.0f};
    u32                   entity_id    = 1;
};

struct VulkanDeviceInfo {
    bool vulkan_headless_active = false;
    char device_name[256]       = "CPU Tile Rasterizer Fallback";
    u32  vendor_id              = 0;
    u32  api_version            = 0;
    u64  staging_buffer_bytes   = 0;
};

struct RenderStats {
    u32 draw_calls           = 0;
    u32 triangles_submitted  = 0;
    u32 triangles_rasterized = 0;
    u32 fragments_shaded     = 0;
};

/// Renderizador 3D Offscreen com aceleração Vulkan Headless opcional e fallback determinístico em CPU.
class GpuRenderer {
public:
    GpuRenderer();
    ~GpuRenderer();

    GpuRenderer(const GpuRenderer&) = delete;
    GpuRenderer& operator=(const GpuRenderer&) = delete;

    bool initialize(u32 width, u32 height) noexcept;
    void shutdown() noexcept;
    void resize(u32 width, u32 height);

    void render_scene(std::span<const DrawCommand> commands,
                      const math::Mat4& view_matrix,
                      const math::Mat4& proj_matrix,
                      f32 time_sec,
                      f32 z_near,
                      f32 z_far,
                      RenderStats* out_stats = nullptr);

    [[nodiscard]] const GBuffer& gbuffer() const noexcept { return gbuffers_[active_read_idx_]; }
    [[nodiscard]] const VulkanDeviceInfo& device_info() const noexcept { return vk_info_; }

private:
    bool init_vulkan_headless(std::size_t staging_bytes) noexcept;
    void destroy_vulkan_headless() noexcept;
    void sync_vulkan_staging_ping_pong(const GBuffer& current_gb) noexcept;

    VulkanDeviceInfo vk_info_{};
    GBuffer          gbuffers_[2];
    u32              active_write_idx_ = 0;
    u32              active_read_idx_  = 0;

    struct VulkanContext;
    VulkanContext* vk_ctx_ = nullptr;
};

} // namespace pokemon_ar::renderer

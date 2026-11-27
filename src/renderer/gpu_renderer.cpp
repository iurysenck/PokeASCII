#include "pokemon_ar/renderer/gpu_renderer.hpp"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace pokemon_ar::renderer {

namespace vk_abi {

using VkFlags      = u32;
using VkBool32     = u32;
using VkDeviceSize = u64;

struct VkInstance_T;       using VkInstance       = VkInstance_T*;
struct VkPhysicalDevice_T; using VkPhysicalDevice = VkPhysicalDevice_T*;
struct VkDevice_T;         using VkDevice         = VkDevice_T*;
struct VkQueue_T;          using VkQueue          = VkQueue_T*;
struct VkCommandPool_T;    using VkCommandPool    = VkCommandPool_T*;
struct VkCommandBuffer_T;  using VkCommandBuffer  = VkCommandBuffer_T*;
struct VkBuffer_T;         using VkBuffer         = VkBuffer_T*;
struct VkDeviceMemory_T;   using VkDeviceMemory   = VkDeviceMemory_T*;
struct VkFence_T;          using VkFence          = VkFence_T*;

inline constexpr i32 VK_SUCCESS = 0;
inline constexpr u32 VK_STRUCTURE_TYPE_APPLICATION_INFO             = 0;
inline constexpr u32 VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO         = 1;
inline constexpr u32 VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO     = 2;
inline constexpr u32 VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO           = 3;
inline constexpr u32 VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO         = 5;
inline constexpr u32 VK_STRUCTURE_TYPE_FENCE_CREATE_INFO            = 8;
inline constexpr u32 VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO           = 12;
inline constexpr u32 VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO     = 39;
inline constexpr u32 VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO = 40;

inline constexpr u32 VK_QUEUE_GRAPHICS_BIT = 0x00000001;
inline constexpr u32 VK_QUEUE_COMPUTE_BIT  = 0x00000002;
inline constexpr u32 VK_BUFFER_USAGE_TRANSFER_SRC_BIT   = 0x00000001;
inline constexpr u32 VK_BUFFER_USAGE_TRANSFER_DST_BIT   = 0x00000002;
inline constexpr u32 VK_BUFFER_USAGE_STORAGE_BUFFER_BIT = 0x00000020;
inline constexpr u32 VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT  = 0x00000002;
inline constexpr u32 VK_MEMORY_PROPERTY_HOST_COHERENT_BIT = 0x00000004;
inline constexpr u32 VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT = 0x00000002;
inline constexpr u32 VK_COMMAND_BUFFER_LEVEL_PRIMARY = 0;

struct VkApplicationInfo {
    u32         sType;
    const void* pNext;
    const char* pApplicationName;
    u32         applicationVersion;
    const char* pEngineName;
    u32         engineVersion;
    u32         apiVersion;
};

struct VkInstanceCreateInfo {
    u32                      sType;
    const void*              pNext;
    VkFlags                  flags;
    const VkApplicationInfo* pApplicationInfo;
    u32                      enabledLayerCount;
    const char* const*       ppEnabledLayerNames;
    u32                      enabledExtensionCount;
    const char* const*       ppEnabledExtensionNames;
};

struct alignas(8) VkPhysicalDeviceLimits {
    u64 opaque_qwords[64];
};

struct VkPhysicalDeviceSparseProperties {
    VkBool32 residencyStandard2DBlockShape;
    VkBool32 residencyStandard2DMultisampleBlockShape;
    VkBool32 residencyStandard3DBlockShape;
    VkBool32 residencyAlignedMipSize;
    VkBool32 residencyNonResidentStrict;
};

struct alignas(8) VkPhysicalDeviceProperties {
    u32                              apiVersion;
    u32                              driverVersion;
    u32                              vendorID;
    u32                              deviceID;
    u32                              deviceType;
    char                             deviceName[256];
    u8                               pipelineCacheUUID[16];
    VkPhysicalDeviceLimits           limits;
    VkPhysicalDeviceSparseProperties sparseProperties;
    u64                              safety_padding[32];
};

struct VkExtent3D { u32 width, height, depth; };

struct VkQueueFamilyProperties {
    VkFlags    queueFlags;
    u32        queueCount;
    u32        timestampValidBits;
    VkExtent3D minImageTransferGranularity;
};

struct VkDeviceQueueCreateInfo {
    u32         sType;
    const void* pNext;
    VkFlags     flags;
    u32         queueFamilyIndex;
    u32         queueCount;
    const f32*  pQueuePriorities;
};

struct VkDeviceCreateInfo {
    u32                            sType;
    const void*                    pNext;
    VkFlags                        flags;
    u32                            queueCreateInfoCount;
    const VkDeviceQueueCreateInfo* pQueueCreateInfos;
    u32                            enabledLayerCount;
    const char* const*             ppEnabledLayerNames;
    u32                            enabledExtensionCount;
    const char* const*             ppEnabledExtensionNames;
    const void*                    pEnabledFeatures;
};

struct VkBufferCreateInfo {
    u32          sType;
    const void*  pNext;
    VkFlags      flags;
    VkDeviceSize size;
    VkFlags      usage;
    u32          sharingMode;
    u32          queueFamilyIndexCount;
    const u32*   pQueueFamilyIndices;
};

struct VkMemoryRequirements {
    VkDeviceSize size;
    VkDeviceSize alignment;
    u32          memoryTypeBits;
};

struct VkMemoryType {
    VkFlags propertyFlags;
    u32     heapIndex;
};

struct VkMemoryHeap {
    VkDeviceSize size;
    VkFlags      flags;
};

struct VkPhysicalDeviceMemoryProperties {
    u32          memoryTypeCount;
    VkMemoryType memoryTypes[32];
    u32          memoryHeapCount;
    VkMemoryHeap memoryHeaps[16];
};

struct VkMemoryAllocateInfo {
    u32          sType;
    const void*  pNext;
    VkDeviceSize allocationSize;
    u32          memoryTypeIndex;
};

struct VkCommandPoolCreateInfo {
    u32         sType;
    const void* pNext;
    VkFlags     flags;
    u32         queueFamilyIndex;
};

struct VkCommandBufferAllocateInfo {
    u32           sType;
    const void*   pNext;
    VkCommandPool commandPool;
    u32           level;
    u32           commandBufferCount;
};

struct VkFenceCreateInfo {
    u32         sType;
    const void* pNext;
    VkFlags     flags;
};

#ifdef _WIN32
#define VKAPI_CALL __stdcall
#else
#define VKAPI_CALL
#endif

extern "C" {
i32  VKAPI_CALL vkCreateInstance(const VkInstanceCreateInfo*, const void*, VkInstance*);
void VKAPI_CALL vkDestroyInstance(VkInstance, const void*);
i32  VKAPI_CALL vkEnumeratePhysicalDevices(VkInstance, u32*, VkPhysicalDevice*);
void VKAPI_CALL vkGetPhysicalDeviceProperties(VkPhysicalDevice, VkPhysicalDeviceProperties*);
void VKAPI_CALL vkGetPhysicalDeviceQueueFamilyProperties(VkPhysicalDevice, u32*, VkQueueFamilyProperties*);
void VKAPI_CALL vkGetPhysicalDeviceMemoryProperties(VkPhysicalDevice, VkPhysicalDeviceMemoryProperties*);
i32  VKAPI_CALL vkCreateDevice(VkPhysicalDevice, const VkDeviceCreateInfo*, const void*, VkDevice*);
void VKAPI_CALL vkDestroyDevice(VkDevice, const void*);
void VKAPI_CALL vkGetDeviceQueue(VkDevice, u32, u32, VkQueue*);
i32  VKAPI_CALL vkCreateBuffer(VkDevice, const VkBufferCreateInfo*, const void*, VkBuffer*);
void VKAPI_CALL vkDestroyBuffer(VkDevice, VkBuffer, const void*);
void VKAPI_CALL vkGetBufferMemoryRequirements(VkDevice, VkBuffer, VkMemoryRequirements*);
i32  VKAPI_CALL vkAllocateMemory(VkDevice, const VkMemoryAllocateInfo*, const void*, VkDeviceMemory*);
void VKAPI_CALL vkFreeMemory(VkDevice, VkDeviceMemory, const void*);
i32  VKAPI_CALL vkBindBufferMemory(VkDevice, VkBuffer, VkDeviceMemory, VkDeviceSize);
i32  VKAPI_CALL vkMapMemory(VkDevice, VkDeviceMemory, VkDeviceSize, VkDeviceSize, VkFlags, void**);
void VKAPI_CALL vkUnmapMemory(VkDevice, VkDeviceMemory);
i32  VKAPI_CALL vkCreateCommandPool(VkDevice, const VkCommandPoolCreateInfo*, const void*, VkCommandPool*);
void VKAPI_CALL vkDestroyCommandPool(VkDevice, VkCommandPool, const void*);
i32  VKAPI_CALL vkAllocateCommandBuffers(VkDevice, const VkCommandBufferAllocateInfo*, VkCommandBuffer*);
i32  VKAPI_CALL vkCreateFence(VkDevice, const VkFenceCreateInfo*, const void*, VkFence*);
void VKAPI_CALL vkDestroyFence(VkDevice, VkFence, const void*);
}

} // namespace vk_abi

struct GpuRenderer::VulkanContext {
    vk_abi::VkInstance       instance        = nullptr;
    vk_abi::VkPhysicalDevice physical_device = nullptr;
    vk_abi::VkDevice         device          = nullptr;
    vk_abi::VkQueue          queue           = nullptr;
    u32                      queue_family    = 0;

    vk_abi::VkBuffer         staging_buffers[2]{nullptr, nullptr};
    vk_abi::VkDeviceMemory   staging_memory[2]{nullptr, nullptr};
    void*                    mapped_ptrs[2]{nullptr, nullptr};
    std::size_t              staging_capacity = 0;

    vk_abi::VkCommandPool    cmd_pool = nullptr;
    vk_abi::VkCommandBuffer  cmd_buf  = nullptr;
    vk_abi::VkFence          fence    = nullptr;
};

GpuRenderer::GpuRenderer() = default;

GpuRenderer::~GpuRenderer() {
    shutdown();
}

bool GpuRenderer::init_vulkan_headless(std::size_t staging_bytes) noexcept {
    using namespace vk_abi;
    vk_ctx_ = new VulkanContext{};

    VkApplicationInfo app_info{};
    app_info.sType              = VK_STRUCTURE_TYPE_APPLICATION_INFO;
    app_info.pApplicationName   = "PokemonAR_ASCII3D";
    app_info.applicationVersion = 1;
    app_info.pEngineName        = "PokemonAR_VulkanHeadless";
    app_info.engineVersion      = 1;
    app_info.apiVersion         = (1u << 22) | (0u << 12) | 0u;

    VkInstanceCreateInfo inst_info{};
    inst_info.sType            = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
    inst_info.pApplicationInfo = &app_info;

    if (vkCreateInstance(&inst_info, nullptr, &vk_ctx_->instance) != VK_SUCCESS || !vk_ctx_->instance) {
        destroy_vulkan_headless();
        return false;
    }

    u32 dev_count = 0;
    if (vkEnumeratePhysicalDevices(vk_ctx_->instance, &dev_count, nullptr) != VK_SUCCESS || dev_count == 0) {
        destroy_vulkan_headless();
        return false;
    }

    std::vector<VkPhysicalDevice> phys_devs(dev_count);
    vkEnumeratePhysicalDevices(vk_ctx_->instance, &dev_count, phys_devs.data());
    vk_ctx_->physical_device = phys_devs[0];

    VkPhysicalDeviceProperties props{};
    vkGetPhysicalDeviceProperties(vk_ctx_->physical_device, &props);

    std::memcpy(vk_info_.device_name, props.deviceName, sizeof(vk_info_.device_name) - 1);
    vk_info_.device_name[sizeof(vk_info_.device_name) - 1] = '\0';
    vk_info_.vendor_id   = props.vendorID;
    vk_info_.api_version = props.apiVersion;

    u32 q_count = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(vk_ctx_->physical_device, &q_count, nullptr);
    std::vector<VkQueueFamilyProperties> q_props(q_count);
    vkGetPhysicalDeviceQueueFamilyProperties(vk_ctx_->physical_device, &q_count, q_props.data());

    u32 chosen_q = 0;
    for (u32 i = 0; i < q_count; ++i) {
        if (q_props[i].queueFlags & (VK_QUEUE_GRAPHICS_BIT | VK_QUEUE_COMPUTE_BIT)) {
            chosen_q = i;
            break;
        }
    }
    vk_ctx_->queue_family = chosen_q;

    const f32 priority = 1.0f;
    VkDeviceQueueCreateInfo q_create{};
    q_create.sType            = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
    q_create.queueFamilyIndex = chosen_q;
    q_create.queueCount       = 1;
    q_create.pQueuePriorities = &priority;

    VkDeviceCreateInfo dev_create{};
    dev_create.sType                = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;
    dev_create.queueCreateInfoCount = 1;
    dev_create.pQueueCreateInfos    = &q_create;

    if (vkCreateDevice(vk_ctx_->physical_device, &dev_create, nullptr, &vk_ctx_->device) != VK_SUCCESS) {
        destroy_vulkan_headless();
        return false;
    }

    vkGetDeviceQueue(vk_ctx_->device, chosen_q, 0, &vk_ctx_->queue);

    VkPhysicalDeviceMemoryProperties mem_props{};
    vkGetPhysicalDeviceMemoryProperties(vk_ctx_->physical_device, &mem_props);

    vk_ctx_->staging_capacity = std::max<std::size_t>(staging_bytes, 64 * 1024);

    for (int i = 0; i < 2; ++i) {
        VkBufferCreateInfo buf_info{};
        buf_info.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
        buf_info.size  = vk_ctx_->staging_capacity;
        buf_info.usage = VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_TRANSFER_SRC_BIT;

        if (vkCreateBuffer(vk_ctx_->device, &buf_info, nullptr, &vk_ctx_->staging_buffers[i]) != VK_SUCCESS) {
            destroy_vulkan_headless();
            return false;
        }

        VkMemoryRequirements mem_req{};
        vkGetBufferMemoryRequirements(vk_ctx_->device, vk_ctx_->staging_buffers[i], &mem_req);

        u32 mem_type_idx = UINT32_MAX;
        const VkFlags desired = VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT;
        for (u32 m = 0; m < mem_props.memoryTypeCount; ++m) {
            if ((mem_req.memoryTypeBits & (1u << m)) &&
                ((mem_props.memoryTypes[m].propertyFlags & desired) == desired)) {
                mem_type_idx = m;
                break;
            }
        }

        if (mem_type_idx == UINT32_MAX) {
            destroy_vulkan_headless();
            return false;
        }

        VkMemoryAllocateInfo alloc_info{};
        alloc_info.sType           = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
        alloc_info.allocationSize  = mem_req.size;
        alloc_info.memoryTypeIndex = mem_type_idx;

        if (vkAllocateMemory(vk_ctx_->device, &alloc_info, nullptr, &vk_ctx_->staging_memory[i]) != VK_SUCCESS ||
            vkBindBufferMemory(vk_ctx_->device, vk_ctx_->staging_buffers[i], vk_ctx_->staging_memory[i], 0) != VK_SUCCESS ||
            vkMapMemory(vk_ctx_->device, vk_ctx_->staging_memory[i], 0, vk_ctx_->staging_capacity, 0, &vk_ctx_->mapped_ptrs[i]) != VK_SUCCESS) {
            destroy_vulkan_headless();
            return false;
        }
    }

    VkCommandPoolCreateInfo pool_info{};
    pool_info.sType            = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
    pool_info.flags            = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
    pool_info.queueFamilyIndex = chosen_q;

    if (vkCreateCommandPool(vk_ctx_->device, &pool_info, nullptr, &vk_ctx_->cmd_pool) != VK_SUCCESS) {
        destroy_vulkan_headless();
        return false;
    }

    VkCommandBufferAllocateInfo cmd_alloc{};
    cmd_alloc.sType              = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
    cmd_alloc.commandPool        = vk_ctx_->cmd_pool;
    cmd_alloc.level              = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
    cmd_alloc.commandBufferCount = 1;

    if (vkAllocateCommandBuffers(vk_ctx_->device, &cmd_alloc, &vk_ctx_->cmd_buf) != VK_SUCCESS) {
        destroy_vulkan_headless();
        return false;
    }

    VkFenceCreateInfo fence_info{};
    fence_info.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
    if (vkCreateFence(vk_ctx_->device, &fence_info, nullptr, &vk_ctx_->fence) != VK_SUCCESS) {
        destroy_vulkan_headless();
        return false;
    }

    vk_info_.vulkan_headless_active = true;
    vk_info_.staging_buffer_bytes   = vk_ctx_->staging_capacity * 2;
    return true;
}

void GpuRenderer::destroy_vulkan_headless() noexcept {
    using namespace vk_abi;
    if (!vk_ctx_) {
        return;
    }

    if (vk_ctx_->device) {
        if (vk_ctx_->fence) {
            vkDestroyFence(vk_ctx_->device, vk_ctx_->fence, nullptr);
        }
        if (vk_ctx_->cmd_pool) {
            vkDestroyCommandPool(vk_ctx_->device, vk_ctx_->cmd_pool, nullptr);
        }
        for (int i = 0; i < 2; ++i) {
            if (vk_ctx_->mapped_ptrs[i]) {
                vkUnmapMemory(vk_ctx_->device, vk_ctx_->staging_memory[i]);
            }
            if (vk_ctx_->staging_buffers[i]) {
                vkDestroyBuffer(vk_ctx_->device, vk_ctx_->staging_buffers[i], nullptr);
            }
            if (vk_ctx_->staging_memory[i]) {
                vkFreeMemory(vk_ctx_->device, vk_ctx_->staging_memory[i], nullptr);
            }
        }
        vkDestroyDevice(vk_ctx_->device, nullptr);
    }

    if (vk_ctx_->instance) {
        vkDestroyInstance(vk_ctx_->instance, nullptr);
    }

    delete vk_ctx_;
    vk_ctx_ = nullptr;
    vk_info_.vulkan_headless_active = false;
}

void GpuRenderer::sync_vulkan_staging_ping_pong(const GBuffer& current_gb) noexcept {
    if (!vk_ctx_ || !vk_info_.vulkan_headless_active) {
        return;
    }

    const std::size_t copy_bytes = std::min(current_gb.size() * sizeof(GBufferPixel), vk_ctx_->staging_capacity);
    void* dst = vk_ctx_->mapped_ptrs[active_write_idx_];
    if (dst && copy_bytes > 0) {
        std::memcpy(dst, current_gb.raw_pixels().data(), copy_bytes);
    }
}

bool GpuRenderer::initialize(u32 width, u32 height) noexcept {
    gbuffers_[0].resize(width, height);
    gbuffers_[1].resize(width, height);
    active_write_idx_ = 0;
    active_read_idx_  = 0;

    const std::size_t needed_bytes = static_cast<std::size_t>(width) * height * sizeof(GBufferPixel);
    (void)init_vulkan_headless(needed_bytes);
    return true;
}

void GpuRenderer::shutdown() noexcept {
    destroy_vulkan_headless();
}

void GpuRenderer::resize(u32 width, u32 height) {
    if (gbuffers_[0].width() == width && gbuffers_[0].height() == height) {
        return;
    }
    gbuffers_[0].resize(width, height);
    gbuffers_[1].resize(width, height);
}

namespace {

struct TransformedVertex {
    math::Vec4 clip_pos;
    math::Vec3 ndc_pos;
    math::Vec2 screen_pos;
    f32        inv_w = 1.0f;
    math::Vec3 view_normal;
    math::Vec3 color;
};

[[nodiscard]] math::Vec3 apply_vertex_wave(const mesh::Vertex& v, const VertexWaveParams& wave, f32 time_sec) noexcept {
    math::Vec3 p = v.position;
    if (wave.mode == WaveDeformMode::CreatureIdleBounce) {
        // Respiração vertical suave + balanço lateral de cauda/chama/orelhas ponderado por uv.x
        const f32 weight = v.uv.x;
        p.y += wave.amplitude * 0.35f * weight * std::sin(wave.frequency * time_sec + wave.phase);
        p.x += wave.amplitude * (weight * weight) * std::cos(wave.frequency * 1.3f * time_sec - wave.spatial_k * weight + wave.phase);
    } else if (wave.mode == WaveDeformMode::GhostFloat) {
        const f32 weight = std::max(0.2f, v.uv.x);
        p.y += wave.amplitude * std::sin(wave.frequency * time_sec + wave.phase);
        p.x += wave.amplitude * 0.6f * weight * std::sin(wave.frequency * 1.7f * time_sec + p.y * 2.5f);
    }
    return p;
}

[[nodiscard]] constexpr f32 edge_function(const math::Vec2& a, const math::Vec2& b, const math::Vec2& p) noexcept {
    return (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
}

} // namespace

void GpuRenderer::render_scene(std::span<const DrawCommand> commands,
                               const math::Mat4& view_matrix,
                               const math::Mat4& proj_matrix,
                               f32 time_sec,
                               f32 z_near,
                               f32 z_far,
                               RenderStats* out_stats) {
    GBuffer& target = gbuffers_[active_write_idx_];
    const u32 w = target.width();
    const u32 h = target.height();

    target.clear(math::Vec3{0.0f, 0.0f, 0.0f}, z_far);

    RenderStats stats{};
    const math::Vec3 light_dir_view = math::Vec3{0.38f, 0.82f, 0.42f}.normalized();

    for (const DrawCommand& cmd : commands) {
        if (!cmd.mesh || cmd.mesh->vertices.empty() || cmd.mesh->indices.size() < 3) {
            continue;
        }
        ++stats.draw_calls;

        const math::Mat4 mv  = view_matrix * cmd.model_matrix;
        const math::Mat4 mvp = proj_matrix * mv;

        const std::size_t tri_count = cmd.mesh->indices.size() / 3;
        stats.triangles_submitted += static_cast<u32>(tri_count);

        for (std::size_t t = 0; t < tri_count; ++t) {
            const u32 i0 = cmd.mesh->indices[t * 3 + 0];
            const u32 i1 = cmd.mesh->indices[t * 3 + 1];
            const u32 i2 = cmd.mesh->indices[t * 3 + 2];

            const mesh::Vertex& v0 = cmd.mesh->vertices[i0];
            const mesh::Vertex& v1 = cmd.mesh->vertices[i1];
            const mesh::Vertex& v2 = cmd.mesh->vertices[i2];

            const math::Vec3 p0 = apply_vertex_wave(v0, cmd.wave, time_sec);
            const math::Vec3 p1 = apply_vertex_wave(v1, cmd.wave, time_sec);
            const math::Vec3 p2 = apply_vertex_wave(v2, cmd.wave, time_sec);

            TransformedVertex tv[3];
            const math::Vec3 pos_arr[3] = {p0, p1, p2};
            const mesh::Vertex* vert_arr[3] = {&v0, &v1, &v2};

            bool behind_near = false;
            for (int k = 0; k < 3; ++k) {
                tv[k].clip_pos = mvp * math::Vec4(pos_arr[k], 1.0f);
                if (tv[k].clip_pos.w <= z_near * 0.5f) {
                    behind_near = true;
                    break;
                }
                tv[k].inv_w   = 1.0f / tv[k].clip_pos.w;
                tv[k].ndc_pos = {
                    tv[k].clip_pos.x * tv[k].inv_w,
                    tv[k].clip_pos.y * tv[k].inv_w,
                    tv[k].clip_pos.z * tv[k].inv_w
                };

                tv[k].screen_pos = {
                    (tv[k].ndc_pos.x * 0.5f + 0.5f) * static_cast<f32>(w),
                    (tv[k].ndc_pos.y * 0.5f + 0.5f) * static_cast<f32>(h)
                };

                tv[k].view_normal = (mv * math::Vec4(vert_arr[k]->normal, 0.0f)).xyz().normalized();
                tv[k].color = {
                    vert_arr[k]->color.x * cmd.tint_color.x,
                    vert_arr[k]->color.y * cmd.tint_color.y,
                    vert_arr[k]->color.z * cmd.tint_color.z
                };
            }

            if (behind_near) {
                continue;
            }

            const f32 area = edge_function(tv[0].screen_pos, tv[1].screen_pos, tv[2].screen_pos);
            if (std::fabs(area) < 1e-5f) {
                continue;
            }

            const f32 inv_area = 1.0f / area;

            const f32 min_xf = std::min({tv[0].screen_pos.x, tv[1].screen_pos.x, tv[2].screen_pos.x});
            const f32 max_xf = std::max({tv[0].screen_pos.x, tv[1].screen_pos.x, tv[2].screen_pos.x});
            const f32 min_yf = std::min({tv[0].screen_pos.y, tv[1].screen_pos.y, tv[2].screen_pos.y});
            const f32 max_yf = std::max({tv[0].screen_pos.y, tv[1].screen_pos.y, tv[2].screen_pos.y});

            const i32 x0 = std::max<i32>(0, static_cast<i32>(std::floor(min_xf)));
            const i32 x1 = std::min<i32>(static_cast<i32>(w) - 1, static_cast<i32>(std::ceil(max_xf)));
            const i32 y0 = std::max<i32>(0, static_cast<i32>(std::floor(min_yf)));
            const i32 y1 = std::min<i32>(static_cast<i32>(h) - 1, static_cast<i32>(std::ceil(max_yf)));

            if (x0 > x1 || y0 > y1) {
                continue;
            }

            ++stats.triangles_rasterized;

            for (i32 py = y0; py <= y1; ++py) {
                for (i32 px = x0; px <= x1; ++px) {
                    const math::Vec2 sample_pt{static_cast<f32>(px) + 0.5f, static_cast<f32>(py) + 0.5f};

                    const f32 w0 = edge_function(tv[1].screen_pos, tv[2].screen_pos, sample_pt) * inv_area;
                    const f32 w1 = edge_function(tv[2].screen_pos, tv[0].screen_pos, sample_pt) * inv_area;
                    const f32 w2 = 1.0f - w0 - w1;

                    if (w0 < 0.0f || w1 < 0.0f || w2 < 0.0f) {
                        continue;
                    }

                    const f32 z_ndc = w0 * tv[0].ndc_pos.z + w1 * tv[1].ndc_pos.z + w2 * tv[2].ndc_pos.z;
                    if (z_ndc < 0.0f || z_ndc > 1.0f) {
                        continue;
                    }

                    f32& depth_slot = target.ndc_depth_at(static_cast<u32>(px), static_cast<u32>(py));
                    if (z_ndc >= depth_slot) {
                        continue;
                    }
                    depth_slot = z_ndc;

                    const f32 persp_w0 = w0 * tv[0].inv_w;
                    const f32 persp_w1 = w1 * tv[1].inv_w;
                    const f32 persp_w2 = w2 * tv[2].inv_w;
                    const f32 inv_persp_sum = 1.0f / (persp_w0 + persp_w1 + persp_w2);

                    const f32 b0 = persp_w0 * inv_persp_sum;
                    const f32 b1 = persp_w1 * inv_persp_sum;
                    const f32 b2 = persp_w2 * inv_persp_sum;

                    math::Vec3 interp_norm = (tv[0].view_normal * b0 + tv[1].view_normal * b1 + tv[2].view_normal * b2).normalized();
                    if (area < 0.0f) {
                        interp_norm = -interp_norm;
                    }

                    const math::Vec3 base_col = tv[0].color * b0 + tv[1].color * b1 + tv[2].color * b2;

                    const f32 ndotl = std::max(0.0f, math::dot(interp_norm, light_dir_view));
                    const f32 rim   = std::pow(1.0f - std::min(1.0f, std::fabs(interp_norm.z)), 2.0f) * 0.40f;
                    const f32 light_intensity = std::min(1.35f, 0.34f + 0.72f * ndotl + rim);

                    GBufferPixel& out_px = target.at(static_cast<u32>(px), static_cast<u32>(py));
                    out_px.albedo = {
                        std::min(1.0f, base_col.x * light_intensity),
                        std::min(1.0f, base_col.y * light_intensity),
                        std::min(1.0f, base_col.z * light_intensity)
                    };
                    out_px.linear_depth = math::linearize_depth_vulkan(z_ndc, z_near, z_far);
                    out_px.view_normal  = interp_norm;
                    out_px.entity_id    = cmd.entity_id;

                    ++stats.fragments_shaded;
                }
            }
        }
    }

    sync_vulkan_staging_ping_pong(target);
    active_read_idx_  = active_write_idx_;
    active_write_idx_ = (active_write_idx_ + 1) % 2;

    if (out_stats != nullptr) {
        *out_stats = stats;
    }
}

} // namespace pokemon_ar::renderer

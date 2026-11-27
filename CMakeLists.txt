cmake_minimum_required(VERSION 3.24)
project(pokemon_ar_ascii3d VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /WX /permissive- /Zc:__cplusplus /EHsc /fp:fast /utf-8)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -Werror)
endif()

# Módulo 1: Matemática 3D e Projeção AR 6DoF (Header-Only)
add_library(pokemon_ar_math INTERFACE)
target_include_directories(pokemon_ar_math INTERFACE
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)

# Módulo 2: Apresentador TTY Cross-Platform e Serializador ANSI TrueColor
add_library(pokemon_ar_tty STATIC
    src/tty/tty_presenter.cpp
)
target_include_directories(pokemon_ar_tty PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(pokemon_ar_tty PUBLIC pokemon_ar_math)

# Módulo 3: Geometria 3D, Malhas de Pokémons, Pokébola e Carregador OBJ
add_library(pokemon_ar_mesh STATIC
    src/mesh/mesh.cpp
)
target_include_directories(pokemon_ar_mesh PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(pokemon_ar_mesh PUBLIC pokemon_ar_math)

# Módulo 4: Rastreador 3D Adaptativo de Ambiente (Sensor Fusion IMU + Fluxo Óptico Sobel KLT + Governador de FPS)
add_library(pokemon_ar_tracker STATIC
    src/tracker/ar_tracker.cpp
)
target_include_directories(pokemon_ar_tracker PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(pokemon_ar_tracker PUBLIC pokemon_ar_tty pokemon_ar_math)

# Módulo 5: Renderizador 3D Vulkan Headless & G-Buffer Offscreen
if(WIN32)
    set(VULKAN_IMPORT_LIB "${CMAKE_CURRENT_BINARY_DIR}/vulkan-1.lib")
    add_custom_command(
        OUTPUT "${VULKAN_IMPORT_LIB}"
        COMMAND lib.exe /nologo "/def:${CMAKE_CURRENT_SOURCE_DIR}/src/renderer/vulkan-1.def" "/out:${VULKAN_IMPORT_LIB}" /machine:x64
        DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/renderer/vulkan-1.def"
        COMMENT "Gerando biblioteca de importacao IAT nativa para vulkan-1.dll"
    )
    add_custom_target(vulkan_iat_target DEPENDS "${VULKAN_IMPORT_LIB}")
endif()

add_library(pokemon_ar_renderer STATIC
    src/renderer/gpu_renderer.cpp
)
target_include_directories(pokemon_ar_renderer PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
if(WIN32)
    add_dependencies(pokemon_ar_renderer vulkan_iat_target)
    target_link_libraries(pokemon_ar_renderer PUBLIC pokemon_ar_mesh "${VULKAN_IMPORT_LIB}")
else()
    target_link_libraries(pokemon_ar_renderer PUBLIC pokemon_ar_mesh vulkan)
endif()

# Módulo 6: Quantizador ASCII 3D com Fusão de Câmera Real + Sobel 3D
add_library(pokemon_ar_postproc STATIC
    src/postproc/ascii_postproc.cpp
)
target_include_directories(pokemon_ar_postproc PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(pokemon_ar_postproc PUBLIC pokemon_ar_renderer pokemon_ar_tracker pokemon_ar_tty pokemon_ar_math)

# Módulo 7: Sessão de Gameplay Pokémon GO AR (Física de Pokébola 3D e Captura)
add_library(pokemon_ar_game STATIC
    src/game/ar_game.cpp
)
target_include_directories(pokemon_ar_game PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(pokemon_ar_game PUBLIC pokemon_ar_postproc pokemon_ar_renderer pokemon_ar_tracker pokemon_ar_mesh pokemon_ar_math)

# Executável Principal de Terminal Nativo
add_executable(pokemon_ar_preview src/preview_main.cpp)
target_link_libraries(pokemon_ar_preview PRIVATE
    pokemon_ar_game
    pokemon_ar_postproc
    pokemon_ar_renderer
    pokemon_ar_tracker
    pokemon_ar_tty
    pokemon_ar_mesh
    pokemon_ar_math
)

enable_testing()

add_executable(test_math tests/test_math.cpp)
target_link_libraries(test_math PRIVATE pokemon_ar_math)
add_test(NAME Modulo1_MathTests COMMAND test_math)

add_executable(test_tty tests/test_tty.cpp)
target_link_libraries(test_tty PRIVATE pokemon_ar_tty)
add_test(NAME Modulo2_TtyTests COMMAND test_tty)

add_executable(test_mesh tests/test_mesh.cpp)
target_link_libraries(test_mesh PRIVATE pokemon_ar_mesh)
add_test(NAME Modulo3_MeshTests COMMAND test_mesh)

add_executable(test_tracker tests/test_tracker.cpp)
target_link_libraries(test_tracker PRIVATE pokemon_ar_tracker)
add_test(NAME Modulo4_TrackerTests COMMAND test_tracker)

add_executable(test_renderer tests/test_renderer.cpp)
target_link_libraries(test_renderer PRIVATE pokemon_ar_renderer)
add_test(NAME Modulo5_RendererTests COMMAND test_renderer)

add_executable(test_postproc_and_game tests/test_postproc.cpp)
target_link_libraries(test_postproc_and_game PRIVATE pokemon_ar_game pokemon_ar_postproc)
add_test(NAME Modulo6_PostProcAndGameTests COMMAND test_postproc_and_game)

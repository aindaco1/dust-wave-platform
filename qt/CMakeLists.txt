cmake_minimum_required(VERSION 3.24)
project(DustWaveQt VERSION 0.1.0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
find_package(Qt6 REQUIRED COMPONENTS Core Network)

add_library(DustWaveQtSupport STATIC src/ReviewedReportClient.cpp include/DustWave/ReviewedReportClient.h)
target_include_directories(DustWaveQtSupport PUBLIC include)
target_link_libraries(DustWaveQtSupport PUBLIC Qt6::Core Qt6::Network)

option(DUSTWAVE_QT_SPARKLE "Build the macOS Sparkle adapter" ON)
if(DUSTWAVE_QT_SPARKLE)
  if(NOT APPLE)
    message(FATAL_ERROR "Sparkle requires macOS")
  endif()
  enable_language(OBJCXX)
  include(FetchContent)
  FetchContent_Declare(dustwave_sparkle
    URL https://github.com/sparkle-project/Sparkle/releases/download/2.10.0/Sparkle-for-Swift-Package-Manager.zip
    URL_HASH SHA256=17e28312b8e18ab7cdbbe09a6fb28cc55a5479ec6c371dbc07cdecd2a14fd959
    DOWNLOAD_EXTRACT_TIMESTAMP FALSE)
  FetchContent_MakeAvailable(dustwave_sparkle)
  set(DUSTWAVE_SPARKLE_FRAMEWORK "${dustwave_sparkle_SOURCE_DIR}/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework" CACHE INTERNAL "Pinned Sparkle framework")
  add_library(DustWaveQtUpdates STATIC src/SparkleUpdater.mm include/DustWave/SparkleUpdater.h)
  target_include_directories(DustWaveQtUpdates PUBLIC include)
  target_compile_options(DustWaveQtUpdates PRIVATE "$<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>")
  target_link_libraries(DustWaveQtUpdates PUBLIC Qt6::Core "${DUSTWAVE_SPARKLE_FRAMEWORK}" "-framework AppKit")
  # The consumer calls this for each executable that links the updater. Preserve
  # framework symlinks and nested XPC services; its release pipeline signs them.
  function(dustwave_embed_sparkle target)
    set_property(TARGET ${target} APPEND PROPERTY BUILD_RPATH "@executable_path/../Frameworks")
    set_property(TARGET ${target} APPEND PROPERTY INSTALL_RPATH "@executable_path/../Frameworks")
    add_custom_command(TARGET ${target} POST_BUILD
      COMMAND /usr/bin/ditto "${DUSTWAVE_SPARKLE_FRAMEWORK}" "$<TARGET_BUNDLE_DIR:${target}>/Contents/Frameworks/Sparkle.framework"
      VERBATIM)
  endfunction()
endif()

include(CTest)
if(BUILD_TESTING)
  find_package(Qt6 REQUIRED COMPONENTS Test)
  add_executable(dustwave_qt_support_tests tests/ReviewedReportClientTest.cpp)
  target_link_libraries(dustwave_qt_support_tests PRIVATE DustWaveQtSupport Qt6::Test)
  add_test(NAME dustwave_qt_support COMMAND dustwave_qt_support_tests)
endif()

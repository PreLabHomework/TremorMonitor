if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/Hamza/.gradle/caches/8.13/transforms/92b8c7343e432d6b9691ea122a3eb8da/transformed/hermes-android-250829098.0.9-debug/prefab/modules/hermesvm/libs/android.x86/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Hamza/.gradle/caches/8.13/transforms/92b8c7343e432d6b9691ea122a3eb8da/transformed/hermes-android-250829098.0.9-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

